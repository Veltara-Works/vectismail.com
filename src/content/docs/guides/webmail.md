---
title: Webmail (Roundcube)
description: Accessing the built-in Roundcube webmail and managing user filters.
---

Vectis ships with [Roundcube](https://roundcube.net/) webmail enabled by
default. End users sign in with their normal mailbox credentials — no
extra configuration required.

## Where it lives

After install, webmail is available at:

```
https://webmail.<your-mail-domain>
```

For example, on a Vectis install with hostname `mail.example.com` the
webmail URL is `https://webmail.example.com`. TLS is provisioned
automatically via Traefik + acme.sh.

## Signing in

Users authenticate against Dovecot using:

- **Username:** their full email address (e.g. `alice@example.com`)
- **Password:** the password set when the mailbox was created in the
  admin UI

Failed-login lockouts and rate-limiting are handled by the underlying
Postfix/Dovecot stack; abusive patterns surface in the admin UI's
**Abuse** dashboard.

## Sieve filter rules

Roundcube includes a Sieve plugin that lets users manage server-side
filter rules — vacation auto-responders, folder routing, label tagging,
forwarding. The plugin talks to Dovecot's ManageSieve service on port
4190 (handled internally; no end-user configuration needed).

To create a rule:

1. Log in to webmail.
2. Click **Settings** (gear icon, top right).
3. Open **Filters**.
4. **Create** a filter set, then add rules within it.
5. Save — rules apply on the next inbound delivery.

## Custom branding

The Roundcube install uses the **Elastic** skin with a Vectis-themed
overlay (logos, accent colour). Operators on Pro can override the skin
further via the Vectis admin UI's branding controls *(custom branding
ships in v0.1.1)*.

## Operator notes

- Webmail runs in two containers: `vectis-webmail` (Roundcube PHP-FPM)
  and `vectis-webmail-nginx` (the static + FastCGI front-end). Both are
  managed by the orchestrator; no manual restarts needed for routine
  upgrades.
- Roundcube's database lives in a Postgres schema dedicated to the
  webmail role; user mail data itself stays in the Dovecot maildirs.
- If webmail returns a blank page or `502`, check `docker logs
  vectis-webmail-nginx` first — the nginx container fronts both
  static assets and the FastCGI socket and surfaces upstream
  connection issues clearly.
