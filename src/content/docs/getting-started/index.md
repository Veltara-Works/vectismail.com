---
title: Introduction
description: "What Vectis Mail is, who it's for, and what you get out of the box: mailboxes, a sending API, webhooks, spam filtering, and browser webmail on your own VPS."
---

Vectis Mail is a containerised, self-hosted email platform. It packages Postfix, Dovecot, Rspamd, Traefik, Postgres, and Valkey into a single deployment managed through one configuration file and a REST API.

## Who is Vectis Mail for?

- **Developers** who need a transactional email API they control (replacing Sendgrid, Postmark, SES)
- **SaaS operators** who need inbound email processing via webhooks
- **Sysadmins** who want a modern alternative to Mailcow or iRedMail
- **Organisations** that require self-hosted email for compliance or data sovereignty

## What you get

| Component | Purpose |
|-----------|---------|
| **Postfix** | Inbound/outbound SMTP, virtual domain hosting |
| **Dovecot** | IMAP/POP3, LMTP delivery, ManageSieve filters |
| **Rspamd** | Spam filtering, DKIM signing, greylisting |
| **Traefik** | Reverse proxy, automatic TLS, rate limiting |
| **Postgres** | All state — domains, mailboxes, aliases, config |
| **Valkey** | Sessions, caching, abuse detection counters |
| **Admin UI** | Web dashboard for managing everything |
| **REST API** | Programmatic control over all features |
| **Orchestrator** | Atomic updates with snapshot/rollback |

## How it works

1. **Run the installer.** It asks for two things: your mail server's hostname
   (detected for you where it can be) and an email address for TLS certificates.
   It generates every password and key itself.
2. **Vectis builds and runs the whole mail stack** (Postfix, Dovecot, Rspamd and
   Traefik) with every service config generated for you.
3. **Add domains and mailboxes from the admin dashboard.** They take effect
   immediately, with no restarts.
4. **Manage the rest from the dashboard or the REST API:** DKIM keys, backups,
   updates, and per-domain spam controls on Pro.
5. **Prefer configuration as code?** Advanced settings live in one readable
   `config.yaml` you can keep in version control and apply with a single
   command. You never have to touch it.

## Next steps

- [Install Vectis Mail](/getting-started/installation/) on your server
- [Add your first domain](/getting-started/first-domain/) and mailbox
- [Configure DNS](/getting-started/dns-setup/) for deliverability
