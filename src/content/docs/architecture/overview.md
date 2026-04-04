---
title: "Architecture Overview"
description: "Vectis Mail system architecture: container layout, Docker networks, data flow for inbound and outbound mail, database schema, and security model."
---

Vectis is a containerised, self-hosted email platform. Every component runs in a Docker container, isolated across four purpose-built networks. This page covers the container layout, data flow, database design, and security model.

## Architecture diagram

```
                        Internet
                           |
             +-------------+-------------+
             |             |             |
          Port 80/443   Port 25/587/465  Port 993/995
             |             |             |
    +--------+--------+   |    +--------+--------+
    |     Traefik      |   |    |     Dovecot      |
    |  (reverse proxy) |   |    |   (IMAP/POP3)    |
    +--------+--------+   |    +--------+--------+
             |             |             |
     vectis-frontend       |       vectis-mail
             |             |             |
    +--------+--------+   |    +--------+--------+
    |     Go API       |   +--->|     Postfix      |
    |  + Admin UI SPA  |        |     (SMTP)       |
    +--------+--------+        +--------+--------+
             |                      |         |
    vectis-data             vectis-mail   vectis-data
    vectis-orchestrator         |         |
             |             +----+----+    |
             |             |  Rspamd |    |
    +--------+--------+   | (spam/  |    |
    |   Orchestrator   |   |  DKIM)  |    |
    | (Docker socket)  |   +----+----+    |
    +--------+--------+        |          |
             |            +----+----+     |
       vectis-data        | ClamAV  |     |
       vectis-orchestrator| (opt.)  |     |
             |            +---------+     |
             |                            |
    +--------+--------+   +---------+     |
    |    Postgres      |   |  Valkey |     |
    |   (database)     |   | (cache) |     |
    +------------------+   +---------+     |
             |                  |          |
             +------ vectis-data ----------+
```

## Container layout

Vectis runs 10 containers (9 if ClamAV is disabled):

| Container | Role | Networks |
|-----------|------|----------|
| **Traefik** | Reverse proxy, TLS termination, ACME certificates | frontend |
| **Go API** | REST API + embedded admin UI (React SPA) | frontend, data, orchestrator |
| **Postfix** | SMTP server (inbound + outbound mail) | mail, data |
| **Dovecot** | IMAP/POP3 server, mail storage | mail, data |
| **Rspamd** | Spam filtering, DKIM signing, greylisting | mail, data |
| **ClamAV** | Antivirus scanning (optional) | mail |
| **Postgres** | Primary database | data |
| **Valkey** | Session cache, rate limiting, Rspamd data | data |
| **Orchestrator** | Update lifecycle, Docker socket access | orchestrator, data |
| **acme.sh** | Mail TLS certificate management | frontend |

The admin UI is not a separate container. The React SPA is compiled to static files and served directly by the Go API container.

## Four Docker networks

Network isolation follows the principle of least privilege. Each container connects only to the networks it needs.

| Network | Type | Purpose |
|---------|------|---------|
| `vectis-frontend` | bridge (external) | Web traffic: Traefik to API and UI. The only network with external access (required for ACME challenges). |
| `vectis-mail` | bridge (internal) | Mail service communication: Postfix, Dovecot, Rspamd, ClamAV. |
| `vectis-data` | bridge (internal) | Database and cache access: Postgres, Valkey, and all services that query them. |
| `vectis-orchestrator` | bridge (internal) | Orchestrator control plane: API to Orchestrator communication. |

### Why this separation matters

- **Postfix and Dovecot query Postgres directly** via read-only SQL users (`vectis_postfix`, `vectis_dovecot`). This avoids routing every mail delivery through the API, which would add latency and create a single point of failure.
- **ClamAV is fully isolated** to the mail network. It only communicates with Rspamd (for scanning) and Postfix (milter protocol). No database or API access.
- **The Orchestrator is the only container with Docker socket access**, mounted read-only. It controls the update lifecycle (pull images, restart services, rollback).

## Port mapping

Only three containers have ports mapped to the host:

| Container | Ports | Protocol |
|-----------|-------|----------|
| Traefik | 80 (HTTP), 443 (HTTPS) | TCP -- TLS terminated by Traefik |
| Postfix | 25 (SMTP), 465 (SMTPS), 587 (Submission) | TCP -- mail protocols handle their own TLS |
| Dovecot | 993 (IMAPS), 995 (POP3S) | TCP -- implicit TLS |

Mail ports are direct-mapped (not proxied through Traefik) because mail protocols handle their own TLS via STARTTLS and implicit TLS. All inter-container communication uses Docker DNS resolution.

## Data flow

### Inbound mail

```
External MTA --> Port 25 --> Postfix --> Rspamd (spam check)
                                          |
                                     [ClamAV scan if enabled]
                                          |
                                     Rspamd --> Postfix
                                          |
                                     LMTP (port 24) --> Dovecot
                                          |
                                     Dovecot writes to Maildir
                                          |
                                     Postfix notifies API (internal webhook)
                                          |
                                     API fires mail.received webhook
```

1. External mail arrives at Postfix on port 25.
2. Postfix queries Postgres to verify the recipient domain and mailbox exist (read-only SQL user).
3. Postfix passes the message to Rspamd via the milter protocol for spam/virus scanning.
4. Rspamd optionally forwards to ClamAV for antivirus scanning.
5. If the message passes, Postfix delivers it to Dovecot via LMTP on port 24.
6. Dovecot stores the message in the Maildir at `/var/vectis/mail/<domain>/<user>/Maildir/`.
7. A Postfix notification script POSTs to the API's internal endpoint.
8. The API stores message metadata and fires webhook events.

### Outbound mail

```
API (POST /send) --> Postfix (port 25) --> Rspamd (DKIM signing)
                                             |
                                        Rspamd --> Postfix
                                             |
                                        Postfix --> Remote MTA
```

1. A client sends `POST /api/v1/send` with the message payload.
2. The API validates domain ownership, RBAC, and abuse detection.
3. The API submits the message to Postfix via SMTP.
4. Postfix passes through Rspamd, which adds the DKIM signature.
5. Postfix delivers the message to the recipient's MTA.
6. The API stores message metadata and fires the `mail.sent` webhook.

### API requests

```
Browser/Client --> HTTPS (port 443) --> Traefik --> Go API
                                                      |
                                                 Postgres (read/write)
                                                 Valkey (sessions, cache)
```

1. Requests arrive at Traefik on port 443 (TLS terminated).
2. Traefik routes to the Go API container based on path prefix.
3. The API authenticates via session cookie or API key.
4. The API reads from and writes to Postgres (using `vectis_api`, the full-access user).
5. Session lookups hit Valkey first for fast validation.

## Database schema

Postgres is the primary data store. All tables use UUIDv7 primary keys (time-sortable, clustering-safe) generated by the Go application.

### Core tables

| Table | Purpose | Key fields |
|-------|---------|------------|
| `domains` | Mail domains | name, active, dkim_selector, spam_threshold, max_mailboxes |
| `mailboxes` | Email accounts | domain_id, local_part, password_hash (Argon2id), quota_mb |
| `aliases` | Mail forwarding | domain_id, source_local_part, destination |
| `admins` | Admin accounts | email, password_hash, role, totp_secret, totp_enabled |
| `sessions` | Active sessions | admin_id, token_hash (SHA-256), ip_address, expires_at |
| `api_keys` | API keys | admin_id, key_hash (SHA-256), key_prefix, scoped_domain_ids |
| `audit_log` | Change history | admin_id, action, resource_type, resource_id, details (JSONB) |
| `messages` | Message metadata | domain_id, message_id, direction, sender, recipients, status |
| `mail_stats` | Aggregate stats | domain_id, sent, received, bounced, spam, failed |
| `webhooks` | Webhook registrations | url, events, secret, domain_id |
| `orchestrator_history` | Update operations | action, status, plan_summary (JSONB), snapshot_path |
| `backup_jobs` | Async backup ops | action, status, progress, backup_path |

### Three Postgres users

Principle of least privilege applied at the database level:

| User | Access | Used by |
|------|--------|---------|
| `vectis_postfix` | Read-only: domains, mailboxes, aliases | Postfix (SQL lookups for mail routing) |
| `vectis_dovecot` | Read-only: domains, mailboxes | Dovecot (authentication + mailbox location) |
| `vectis_api` | Full read/write on all tables | Go API server |

Postfix and Dovecot never need write access. If either container is compromised, the attacker cannot modify data.

### Conventions

- All primary keys are UUIDv7, generated by Go (not Postgres sequences).
- All timestamps are `TIMESTAMPTZ` stored in UTC.
- Foreign keys on domain deletion use `RESTRICT` (prevents accidental cascade).
- Foreign keys on admin deletion use `SET NULL` (preserves audit history) or `CASCADE` (sessions).
- Passwords use Argon2id (memory=64 MB, iterations=3, parallelism=4).
- Forward-only migrations via golang-migrate. Rollback is snapshot-based (`pg_dump` before apply, `psql` to restore).

## Security model

### Network isolation

The four-network design ensures that a compromise of one service limits the blast radius:

- ClamAV compromise: attacker can only reach Rspamd and Postfix on the mail network. No database, no API.
- Admin UI compromise: the SPA communicates only via the authenticated API. No direct database access.
- Rspamd compromise: access to mail network services and Valkey (ephemeral data only). No direct API access.

### Authentication and authorization

- Admin sessions use HMAC-signed cookies with `HttpOnly`, `Secure`, `SameSite=Strict`.
- Session tokens are 256-bit random, stored as SHA-256 hashes in Postgres.
- API keys use the `vectis_` prefix, stored as SHA-256 hashes. Raw keys are shown only at creation.
- TOTP MFA is available for admin accounts (TOTP secret encrypted at rest).
- Three RBAC roles (`super_admin`, `admin`, `domain_admin`) with domain-level scoping for `domain_admin`.

### Service-to-service authentication

- Postfix notification script authenticates to the API via an internal token (`X-Internal-Token` header).
- Orchestrator to API communication uses mTLS (preferred) or bearer token (fallback).
- All internal communication stays on Docker internal networks (not routable from the host network).

### Data protection

- Secrets live in `secrets.yaml` (mode `0600`), separate from configuration.
- Database credentials use three separate users with minimal privileges.
- Backup archives are encrypted with a dedicated key (or the API secret as fallback).
- DKIM private keys are stored at `/var/vectis/dkim/` with restricted file permissions.

### Update safety

- The orchestrator takes a `pg_dump` snapshot before every update.
- Health checks run after every update. If any service fails, automatic rollback restores the snapshot and reverts container images.
- Advisory locks (`pg_advisory_lock(1)`) prevent concurrent update operations.
- The orchestrator state machine enforces a strict sequence: plan, snapshot, migrate, pull, restart, health check.

## Related

- [API Overview](/api/) -- the REST API
- [CLI Overview](/cli/) -- managing Vectis from the command line
- [CLI Commands](/cli/commands) -- full command reference
