---
title: Webmail (Roundcube)
description: "Access the built-in Roundcube webmail that ships with Vectis Mail: log in, read and send mail in the browser, and manage per-user Sieve filters."
---

Vectis ships with [Roundcube](https://roundcube.net/) webmail, on by default
for new installs from v0.1.62. End users sign in with their normal mailbox
credentials, with no extra configuration.

## Where it lives

After install, webmail is available at `/webmail/` on your mail hostname:

```
https://mail.example.com/webmail/
```

It uses the same TLS certificate as the admin UI, so no extra DNS record is
needed.

## Turning it on or off

The setting is in `/etc/vectis/config.yaml`:

```yaml
webmail:
  enabled: true
```

Installs from before v0.1.62 have it off unless you turned it on. Change the
value, then run `vectis config apply`. The container uses about 50 MB of RAM
when idle.

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
overlay (logos, accent colour).

## Operator notes

- Webmail runs in one container, `vectis-webmail` (Roundcube on Apache). It is
  managed by the orchestrator; no manual restarts are needed for routine
  upgrades.
- Roundcube keeps its own settings in an SQLite database in the `webmail-data`
  volume; user mail stays in the Dovecot maildirs.
- If webmail returns a blank page or `502`, check `docker logs vectis-webmail`
  first.
