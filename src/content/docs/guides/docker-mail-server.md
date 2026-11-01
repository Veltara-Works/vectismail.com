---
title: "Docker Mail Server: What Production Actually Needs"
description: "Running a mail server in Docker? The containers are the easy part. Here's the state, DNS, health-check and update traps that decide whether it holds up."
lastUpdated: 2026-10-18
faq:
  - q: "Can you run a production mail server in Docker?"
    a: "Yes. Postfix, Dovecot, rspamd and the rest run well in containers, and Docker makes the stack reproducible and easy to update. What decides whether it holds up in production isn't Docker itself but a handful of details: which state survives a container recreate (mailboxes, DKIM keys and the mail queue), how DNS lookups leave the containers, whether health checks test real mail flow, and how updates are snapshotted and rolled back."
  - q: "What containers does a Docker mail server need?"
    a: "At minimum: an MTA to send and receive (usually Postfix), an IMAP server for mailboxes (usually Dovecot), a spam filter (rspamd is the common modern choice), and TLS termination. Most production stacks add a database for domains and mailboxes, a cache, optional antivirus (ClamAV), webmail, and something that manages updates. Vectis Mail runs Postfix, Dovecot, rspamd, optional ClamAV, Traefik, PostgreSQL, Valkey and optional webmail, plus its own API and update orchestrator."
  - q: "How much RAM does a Docker mail server need?"
    a: "For a small install, 2 GB is a workable minimum if you skip antivirus; 4 GB is comfortable and is what we recommend for a single-domain server. ClamAV alone needs over 1 GB because it holds its signature database in memory. Vectis Mail sets a hard memory ceiling per container so one service running out of memory can't take the whole host down."
  - q: "Which data must be on a volume in a Docker mail server?"
    a: "Everything that isn't rebuilt from configuration: mailboxes, DKIM private keys, TLS certificates, the database, and Postfix's mail queue (/var/spool/postfix). The queue is the one most often missed. If it lives in the container's writable layer, recreating the container (which every update does) deletes mail that was accepted but not yet delivered."
  - q: "Do I need port 25 open to run a Docker mail server?"
    a: "Yes. Port 25 must be reachable inbound (that's where other servers deliver to you) and outbound (that's how you deliver to them). Many cloud and VPS providers block outbound port 25 by default and unblock it on request. You also need a reverse DNS (PTR) record for your server's IP that matches its mail hostname. Docker doesn't change either requirement."
  - q: "Is it safe to give a mail container access to the Docker socket?"
    a: "Treat the Docker socket as root on the host: any container that mounts it can start privileged containers. Mount it only where something genuinely has to manage containers, read-only wherever possible, and never in a container that faces the internet. In Vectis Mail only the update orchestrator manages the stack, and the internet-facing mail containers have no socket access."
---

**Short answer.** A Docker mail server is a set of containers (an MTA such as Postfix, an IMAP server such as Dovecot, a spam filter such as rspamd, TLS termination, and usually a database) running on one Linux host with ports 25, 465, 587 and 993 exposed. Getting the containers running takes an afternoon. What decides whether it survives months of production is less visible: **which state survives a container recreate, how DNS leaves the containers, whether health checks test real mail flow, and how updates are snapshotted and rolled back.** This guide covers each of those, with what we learned running [Vectis Mail](/) in production.

## What's in a Docker mail server

| Job | Common choice | In Vectis Mail |
|---|---|---|
| Send and receive (SMTP) | Postfix | Postfix |
| Mailboxes (IMAP/POP3) | Dovecot | Dovecot |
| Spam filtering | rspamd | rspamd, with a local DNS resolver (see below) |
| Antivirus | ClamAV (optional) | ClamAV, optional |
| TLS and HTTPS routing | Traefik, nginx, Caddy | Traefik, automatic Let's Encrypt |
| Domains, mailboxes, aliases | SQL database or flat files | PostgreSQL |
| Cache and rate limits | Redis-compatible store | Valkey |
| Webmail | Roundcube, SnappyMail | Optional webmail |
| Management | Admin UI, scripts | Admin UI, REST API, CLI, update orchestrator |

Any of these stacks can work. The differences that matter show up later, in the seven areas below.

## 1. State that must survive a recreate

Docker containers are disposable by design: `docker compose up` recreates a container whenever its image or settings change, and every update does exactly that. Anything not on a volume or bind mount is deleted at that moment.

The obvious state is usually handled: mailboxes, the database, TLS certificates. The ones that get missed:

- **DKIM private keys.** Lose them and every domain sends unsigned mail until you regenerate keys *and* update DNS.
- **The mail queue.** Postfix keeps accepted-but-undelivered mail in `/var/spool/postfix`. On a healthy server it's nearly always empty, which is why a missing volume goes unnoticed, until the day a remote server is down and you update over deferred mail. We had exactly this gap in our own stack and wrote up [how to check yours](/notes/docker-mail-server-queue-lost-on-update/).

**Check:** list the mounts on each container (`docker inspect --format '{{range .Mounts}}{{println .Destination}}{{end}}' <container>`) and make sure every directory that holds data appears.

## 2. Configuration: bind mounts, not named volumes

There are two ways to get configuration into a container, and one of them causes subtle bugs:

- **Named volumes** are seeded from the image the first time they're created and then never change. Ship a corrected config file in a new image and the container keeps using the old copy in the volume. Use named volumes for *data*.
- **Bind mounts** of rendered config files from the host are what you want for configuration. One catch: many tools save a file by writing a new one and renaming it over the old, which gives it a new inode. A container with a *single-file* bind mount keeps reading the old file until it's restarted. Either mount directories, or restart the service after a config change.

Vectis Mail renders every service's configuration from one config file into a host directory, bind-mounts it, and reloads or restarts exactly the services whose files changed.

## 3. DNS from inside the containers

Containers resolve DNS through Docker's embedded resolver, which forwards to whatever the host uses. For most things that's fine. For a spam filter it often isn't: the major DNS blocklists (Spamhaus, URIBL) refuse lookups that come through big shared resolvers, and the refusal looks like a normal DNS answer. On one of our servers, about a quarter of messages were being scored with the blocklists effectively off, and nothing logged an error. We wrote up [the two-command check](/notes/spam-blocklists-silently-stop-working/).

Vectis Mail runs a small local recursive resolver inside the spam-filter container so blocklist queries come from your server alone.

## 4. Health checks that test real mail flow

A container's health check usually runs a command like `postfix status` or `doveadm` inside the container. Those report the *process* is running. They pass with an empty or broken configuration, a missing certificate, or a filter that never loaded its rules.

Better checks connect over the network the way a client would: open a TCP connection to port 25 and read the greeting, complete a TLS handshake on 465 and 993, and ask the spam filter to scan a known test message. The Vectis Mail dashboard probes Postfix, Dovecot, rspamd and Traefik over the network for this reason.

## 5. The Docker socket

Mounting `/var/run/docker.sock` into a container gives it control of Docker, which on most hosts is equivalent to root. Some mail stacks mount it into several containers for convenience.

Keep it to the minimum: only the component that genuinely manages containers, read-only wherever it can be, and never anything internet-facing. In Vectis Mail the update orchestrator holds the socket for stack management, two narrow helpers have only what they need (signalling the mail containers when certificates renew, and, where log shipping is enabled, read-only log discovery), and Postfix, Dovecot and the web-facing services have none.

## 6. Network segmentation

A single flat Docker network lets every container reach every other one, including the database, from the containers that face the internet. Split it up instead: a frontend network for HTTPS, a mail network for SMTP and IMAP, an internal data network for the database and cache that has no route out, and a separate management network. Then each container joins only the networks it needs. Vectis Mail uses four networks along those lines.

## 7. Updates you can trust and undo

Image tags such as `:latest` or even `:v1.2` can be repointed. For a mail server that holds your business email, an update should be:

- **Pinned to image digests** (`image@sha256:…`), ideally from a signed release manifest, so what runs is exactly what was published.
- **Snapshotted first**, with a database dump before any schema migration.
- **Health-gated**, so a failed start stops the update instead of leaving the server half-upgraded.
- **Reversible**, by restoring the snapshot and the previous images.

Vectis Mail's updates run snapshot → migrate → pull → deploy → health check, with rollback, and `vectis verify` confirms the server runs exactly the images and binary published for its version.

## Host requirements Docker doesn't change

- **Port 25, inbound and outbound.** Many VPS providers block outbound 25 by default; get it lifted before you start. See [how to get port 25 unblocked](/guides/port-25-blocked/).
- **Reverse DNS (PTR)** for your IP, matching your mail hostname.
- **SPF, DKIM and DMARC** records for every domain. See our [DKIM, SPF and DMARC guide](/guides/dkim-spf-dmarc/).
- **Memory:** 2 GB is workable without antivirus; 4 GB is comfortable. ClamAV alone needs more than 1 GB. Set per-container memory limits so one service can't take the host down.

## Building your own vs using a packaged stack

Building your own from individual images teaches you a lot and gives you full control, and every item above is solvable with care. A packaged stack is worth it when you'd rather inherit those decisions than make them all yourself. If you're comparing options, our [comparison of self-hosted email servers](/guides/best-self-hosted-email-servers-2026/) covers the main ones, and the [installation guide](/getting-started/installation/) shows what a Vectis Mail install involves, from a fresh Ubuntu VPS to a working server.
