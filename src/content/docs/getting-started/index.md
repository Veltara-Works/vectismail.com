---
title: Introduction
description: What Vectis Mail is, who it's for, and what you get out of the box.
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

1. You write a `config.yaml` describing your mail server
2. Vectis generates all service configs (Postfix, Dovecot, Rspamd, Traefik)
3. Docker Compose runs the full stack
4. Domains and mailboxes are stored in Postgres — no reload needed for changes
5. The admin UI and API give you full control

## Next steps

- [Install Vectis Mail](/getting-started/installation) on your server
- [Add your first domain](/getting-started/first-domain) and mailbox
- [Configure DNS](/getting-started/dns-setup) for deliverability
