---
title: "Best Self-Hosted Email Servers 2026: 8 Compared, 1 Pick"
description: "Which self-hosted email server should you actually run in 2026? A straight comparison of 8 options — mailboxes, sending API, ops burden — with one clear pick."
lastUpdated: 2026-11-01
faq:
  - q: "What is the best self-hosted email server in 2026?"
    a: "For most people self-hosting email in 2026 — teams, SaaS products, agencies, and individuals who want real mailboxes plus a transactional API on a stack they own — Vectis Mail, which starts free."
  - q: "Is Mailcow or Vectis Mail better?"
    a: "They take different approaches. Mailcow is configured through a web UI, ships SOGo groupware, and is updated with a script you run and supervise; its API is administrative. Vectis Mail is managed from an admin dashboard and a REST API, runs every update as an atomic pipeline with automatic rollback, and ships a 40+ endpoint API for transactional sending and inbound parsing, on Postfix, Dovecot and Rspamd."
  - q: "Which self-hosted email server has a sending API?"
    a: "Vectis Mail ships a 40+ endpoint REST API for transactional sending, batch sending, and inbound parse-to-webhook. Stalwart exposes JMAP and webhooks; Mox has an HTTP web API. Mailcow's API is administrative rather than a first-class transactional sending API. iRedMail, Mail-in-a-Box, Mailu and docker-mailserver do not ship a transactional sending API — you would add your own SMTP-submission layer."
  - q: "What is the easiest self-hosted email server to set up?"
    a: "Vectis Mail installs with one guided command and is then managed from a dashboard; a first install including DNS propagation takes about 30–90 minutes. Mail-in-a-Box also installs with one command, on a single Ubuntu 22.04 server, and Mailcow uses Docker Compose plus a web UI."
  - q: "Which self-hosted email servers are built on Postfix and Dovecot?"
    a: "Mailcow, iRedMail, Mail-in-a-Box, Mailu, docker-mailserver and Vectis Mail all build on Postfix (SMTP) and Dovecot (IMAP/POP3), both in production use for over two decades. Stalwart and Mox are from-scratch implementations written in Rust and Go respectively."
  - q: "Can I get commercial support for a self-hosted email server?"
    a: "Yes, from several. Vectis Mail offers paid Pro and Enterprise tiers with priority support and, on Enterprise, a business-hours first-response SLA. Mailcow is backed by ServerCow support contracts. Stalwart and Poste.io offer commercial editions. iRedMail sells paid editions and support. Mail-in-a-Box, Mailu, docker-mailserver and Mox are community-supported open-source projects."
  - q: "Do self-hosted email servers include webmail?"
    a: "Most do. Mailcow, iRedMail, Mailu and Vectis Mail bundle webmail (Roundcube or SOGo). Mail-in-a-Box ships Roundcube and Nextcloud. docker-mailserver and Mox are mail-protocol-focused and expect you to point your own webmail or IMAP client at them. Stalwart's web interface is for administration and account self-service; it doesn't bundle webmail."
  - q: "Which self-hosted email server is best for an agency managing client domains?"
    a: "Vectis Mail is built for it: one install serves every client domain with its own DKIM keys, API keys and analytics, billed flat per tenant rather than per email or per seat. Mailcow and iRedMail can host many domains on one server too, but without per-tenant API keys, per-domain analytics or a flat per-client commercial model out of the box."
---

**Short answer.** For most people self-hosting email in 2026 — teams, SaaS products, agencies, and individuals who want real mailboxes *and* a transactional API on a stack they own, with safe, self-updating operations — **Vectis Mail** is the answer, and it starts free.

The rest of this guide sets out how the eight compare, from each project's public documentation. We build Vectis Mail.

## TL;DR — who Vectis Mail is for

| If you are… | Pick | Why |
|---|---|---|
| A SaaS or product team needing send API + mailboxes | **Vectis Mail** | One stack does transactional sending, inbound webhooks, and IMAP mailboxes |
| An agency running mail for many client domains | **Vectis Mail** | Per-domain keys, DKIM and analytics; flat per-tenant, never per email |
| A team that just needs mail (calendar already in Google/MS) | **Vectis Mail** | Mail you own, with an API and updates that roll back on failure |
| An individual or family who wants a free, owned mailbox | **Vectis Mail** (Starter) | $0, up to 3 domains and 25 mailboxes each |

## The landscape

Self-hosted email in 2026 splits into three families: **assemble-it-yourself** stacks built on Postfix and Dovecot (Mailcow, iRedMail, Mail-in-a-Box, Mailu, docker-mailserver), **from-scratch servers** (Stalwart, Mox), and the **managed-stack-you-own** approach (Vectis Mail). Each family solves a different problem.

### Mailcow — Docker stack with a web UI

Mailcow is a Docker Compose stack of 18 services with SOGo groupware (calendar and contacts) included, administered through a web UI. ServerCow offers paid support contracts.

- **The trade-off:** configuration is imperative — you click through the web UI rather than declaring the stack as code, updates are a manual operation you run and supervise, and the API is administrative rather than a first-class transactional sending API. If your reason for self-hosting is *developer ergonomics*, that is the gap. See the [Mailcow comparison](/alternatives/mailcow/).

### iRedMail — OS-native and LDAP-friendly

iRedMail installs straight onto the operating system — no Docker required — and supports an OpenLDAP backend. It is one of the few options that runs on FreeBSD and OpenBSD.

- **The trade-off:** setup is script-driven, administration is the iRedAdmin panel plus file edits, and day-two operations (updates, backups, rollback) are yours to design. There is no declarative config and no transactional sending API. See the [iRedMail comparison](/alternatives/iredmail/).

Deciding between these two specifically, independent of Vectis Mail? See the direct [iRedMail vs Mailcow comparison](/compare/iredmail-vs-mailcow/).

### Mail-in-a-Box — one-command single server

Mail-in-a-Box installs a complete mail server on a fresh Ubuntu 22.04 machine with one command and, by design, no user-configurable setup options. It bundles Nextcloud for calendar and contacts and is released under CC0.

- **The trade-off:** it is not built for teams, many client domains, or a programmatic sending workload. See the [Mail-in-a-Box comparison](/alternatives/mail-in-a-box/).

Weighing it against Mailcow specifically? See the direct [Mailcow vs Mail-in-a-Box comparison](/compare/mailcow-vs-mail-in-a-box/).

### Mailu and docker-mailserver — Docker stacks

**Mailu** is a Docker Compose stack with a web admin, generated by a setup wizard. **docker-mailserver** is a single image configured entirely through files, with no database and no web UI.

- **The trade-off:** both are mail-plumbing first. Neither ships a transactional sending API, inbound parse-to-webhook, per-domain analytics, or atomic updates with rollback — you assemble those layers yourself.

Weighing Mailu against Stalwart specifically? See the direct [Mailu vs Stalwart comparison](/compare/mailu-vs-stalwart/).

### Stalwart — a from-scratch Rust server

Stalwart is a mail and collaboration server written in Rust, with **JMAP**, CalDAV/CardDAV/WebDAV and **clustering** built in. Version 1.0 shipped in October 2026; existing v0.16 servers migrate with a separate tool rather than upgrading in place.

- **The trade-off:** it is a from-scratch MTA rather than Postfix and Dovecot, it bundles no webmail, and its centre of gravity is groupware rather than a transactional sending platform. \1

Weighing it against Mailcow specifically? See the direct [Stalwart vs Mailcow comparison](/compare/stalwart-vs-mailcow/).

### Mox — a single Go binary

Mox is a single Go binary that runs a complete mail server, MIT-licensed, with **DANE** and **MTA-STS** transport security built in.

- **The trade-off:** also a from-scratch MTA, and intentionally minimal on team administration, multi-tenant operations, and platform features. See the [Mox comparison](/alternatives/mox/).

### Vectis Mail — the managed stack you own

Vectis Mail takes a different stance: orchestrate the **proven components** (Postfix, Dovecot, Rspamd) the internet already runs on, and put a modern surface over them. Your entire stack lives in one declarative `config.yaml`; updates run as a six-phase pipeline that snapshots first and **rolls back automatically** if a health check fails. A 40+ endpoint **REST API** handles transactional sending, batch sending, and inbound parse-to-webhook, alongside full IMAP/POP3 mailboxes, Rspamd and optional ClamAV filtering, bundled Roundcube webmail, and an admin dashboard. Pricing is flat per tenant — **never per email, never per seat** — with paid Pro and Enterprise tiers (the latter adds SAML SSO, compliance tooling, and a support SLA).

- **Best for:** teams, SaaS products, and agencies that want a transactional API *and* mailbox hosting on one stack, with managed-software operations on internals they trust.
- **The trade-off:** Vectis Mail is Linux + Docker only, and it doesn't ship calendar or contacts.

## Feature comparison at a glance

| | Underlying MTA | Config model | Transactional send API | Mailboxes (IMAP/POP3) | Built-in groupware | Managed updates + rollback | Commercial support |
|---|---|---|---|---|---|---|---|
| **Vectis Mail** | Postfix/Dovecot | Declarative YAML + API | Yes — 40+ endpoints | Yes | No (by design) | Yes — atomic, auto-rollback | Pro + Enterprise SLA |
| **Mailcow** | Postfix/Dovecot | Web UI | Administrative only | Yes | Yes (SOGo) | Manual | ServerCow contracts |
| **iRedMail** | Postfix/Dovecot | Install scripts | No | Yes | Via add-on | Manual | Paid editions |
| **Mail-in-a-Box** | Postfix/Dovecot | One-command, opinionated | No | Yes | Yes (Nextcloud) | Manual | Community |
| **Mailu** | Postfix/Dovecot | Compose + web admin | No | Yes | Via add-on | Manual | Community |
| **docker-mailserver** | Postfix/Dovecot | Files in git | No | Yes | No | Manual | Community |
| **Stalwart** | From-scratch (Rust) | Config + web UI | JMAP / webhooks | Yes (JMAP/IMAP) | Yes | Manual | Commercial edition |
| **Mox** | From-scratch (Go) | Single binary + config | HTTP web API | Yes | No | Manual | Community |

*Every row above is the honest picture as we understand it in mid-2026; mail projects move fast, so verify the specifics that matter to you against each project's current docs before you commit.*

## Questions to settle before you choose

1. **Do you need a transactional sending API and inbound webhooks alongside mailboxes?** Vectis Mail ships both on one stack. Stalwart and Mox have APIs you can script against; the others need a separate sending layer.
2. **Who runs updates, and what happens when one fails?** Vectis Mail snapshots, migrates, deploys and health-checks every update, and rolls back automatically on failure. The others are updated by hand.
3. **Postfix and Dovecot, or a from-scratch server?** Vectis Mail, Mailcow, iRedMail, Mailu, docker-mailserver and Mail-in-a-Box run Postfix and Dovecot. Stalwart (Rust) and Mox (Go) implement the protocols from scratch.
4. **Do you need calendar and contacts in the mail server?** Vectis Mail doesn't ship them, so plan where they will live.
5. **Do you need someone to call?** Vectis Mail Pro and Enterprise include priority support, with a business-hours first-response SLA on Enterprise.

Whatever you choose, the deliverability fundamentals are the same: a clean IP with a valid PTR record, correct [SPF, DKIM and DMARC](/guides/dkim-spf-dmarc/), and a sane [warmup](/guides/ip-warmup/) on a fresh IP. The software gets you a server; those records get you the inbox.

## Where Vectis Mail fits

We built Vectis Mail for the buyer the others under-serve: the **team or agency that needs both a transactional API and real mailboxes**, wants their stack **declared as code with safe, reversible updates**, and would rather **own the infrastructure at flat per-tenant pricing** than be metered per email by a SaaS. If that is you, start with the [self-host decision guide](/guides/self-host-email-2026/) for the economics, then the [installation guide](/getting-started/installation/) to stand one up.

## Next steps

- [Should you self-host email? The 2026 decision guide](/guides/self-host-email-2026/) — the TCO math
- [Self-hosted email vs Google Workspace & Microsoft 365](/guides/self-hosted-email-vs-google-workspace-microsoft-365/) — the per-seat cost-and-control comparison vs the big hosted suites
- [Email deliverability best practices](/guides/deliverability/) — getting into the inbox once you have a server
- [SPF, DKIM and DMARC explained](/guides/dkim-spf-dmarc/) — the records every self-hoster must get right
- [How to migrate without downtime](/guides/migrate-to-self-hosted-email/) — the dual-send playbook for switching once you've chosen
- Head-to-head comparisons: [vs Mailcow](/alternatives/mailcow/) · [vs iRedMail](/alternatives/iredmail/) · [vs Mail-in-a-Box](/alternatives/mail-in-a-box/) · [vs Stalwart](/alternatives/stalwart/) · [vs Mox](/alternatives/mox/)
