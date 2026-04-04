---
title: "CLI Commands"
description: "Complete reference for all Vectis CLI commands: preflight, install, status, health, config, domain, mailbox, logs, update, and backup."
---

This page documents every `vectis` CLI command, its flags, input/output, and usage examples.

## Installation commands

### vectis preflight

Runs pre-flight checks without making any changes to the system. Validates OS, hardware, network, DNS, ports, and Docker availability.

```bash
vectis preflight
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--config PATH` | Validate a pre-written `config.yaml` alongside system checks. |

**Example output (success):**

```
Vectis Pre-Flight Check
=======================
OS:          Ubuntu 24.04 LTS          PASS
CPU:         4 vCPU                    PASS
RAM:         8 GB                      PASS
Disk:        80 GB (72 GB free)        PASS
IPv4:        203.0.113.10              PASS
IPv6:        2001:db8::1               PASS
Hostname:    mail.example.com          PASS
DNS A:       203.0.113.10 -> matches   PASS
DNS AAAA:    2001:db8::1 -> matches    PASS
Port 25:     available                 PASS
Port 80:     available                 PASS
Port 443:    available                 PASS
Port 587:    available                 PASS
Port 993:    available                 PASS
SMTP out:    port 25 reachable         PASS
Docker:      not installed (will install) PASS

Ready to install Vectis.
Run: vectis install
```

**Example output (failure):**

```
Vectis Pre-Flight Check
=======================
OS:          Ubuntu 24.04 LTS          PASS
CPU:         1 vCPU                    FAIL  Minimum 2 vCPU required
RAM:         2 GB                      FAIL  Minimum 4 GB recommended (2 GB without ClamAV)
Port 80:     in use by apache2         FAIL  Stop apache2: sudo systemctl stop apache2 && sudo systemctl disable apache2
SMTP out:    port 25 blocked           FAIL  Contact your hosting provider to unblock outbound SMTP (port 25)

2 checks failed, 2 warnings. Fix the above issues before installing.
```

**Exit codes:** `0` = all checks pass, `1` = one or more checks failed.

---

### vectis install

Performs full installation on a fresh server.

```bash
# Interactive (prompts for hostname, admin email, initial domain)
vectis install

# Unattended
vectis install --config /path/to/config.yaml --secrets /path/to/secrets.yaml
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--config PATH` | Path to pre-written config.yaml. |
| `--secrets PATH` | Path to pre-written secrets.yaml. |

**Example output:**

```
Installing Vectis...

[1/8] Installing Docker Engine + Compose... done
[2/8] Configuring Docker (log rotation, IPv6)... done
[3/8] Generating config.yaml... done
[4/8] Generating secrets.yaml... done
[5/8] Generating initial docker-compose.yml... done
[6/8] Pulling container images... done (4m 12s)
[7/8] Starting services... done
[8/8] Running health checks... all services healthy

============================================
  Vectis is ready!

  Admin URL:   https://mail.example.com/admin
  Admin email: admin@example.com
  Password:    Kj7#mP9$xR2q

  IMPORTANT: Change this password immediately.

  Next steps:
  1. Log in to the admin panel
  2. Add your DNS records (shown in Deliverability section)
  3. Create your first mailbox
============================================
```

**Exit codes:** `0` = install complete, `1` = install failed (includes cleanup instructions).

## Status and health commands

### vectis status

Shows the status of all Vectis services.

```bash
vectis status
```

**Example output:**

```
Vectis Status
=============
Service        Status     Uptime      CPU     Memory
-----------------------------------------------------
postfix        healthy    14d 3h      0.2%    48 MB
dovecot        healthy    14d 3h      0.1%    92 MB
rspamd         healthy    14d 3h      1.4%    312 MB
clamav         healthy    14d 3h      0.0%    1.2 GB
postgres       healthy    14d 3h      0.3%    156 MB
valkey         healthy    14d 3h      0.1%    42 MB
api            healthy    14d 3h      0.2%    38 MB
traefik        healthy    14d 3h      0.1%    45 MB
orchestrator   healthy    14d 3h      0.0%    28 MB
```

**Exit codes:** `0` = all services healthy, `1` = one or more unhealthy.

---

### vectis health

Shows detailed health checks with response times.

```bash
# All services
vectis health

# Single service
vectis health --service postfix
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--service NAME` | Show detailed health for a single service. |

**Exit codes:** `0` = all healthy, `1` = one or more unhealthy.

## Configuration commands

### vectis config validate

Validates `config.yaml` and `secrets.yaml` without making any changes.

```bash
vectis config validate
```

**Example error output:**

```
Configuration validation failed:

  config.yaml:14  Invalid domain name: "not a domain"
                  Domain must be a valid FQDN (e.g., example.com)

  config.yaml:28  Unknown ClamAV profile: "turbo"
                  Valid profiles: none, dev, small, production, enterprise

  secrets.yaml:   Missing required key: db_password
                  Add db_password to secrets.yaml

3 errors found.
```

**Exit codes:** `0` = valid, `1` = validation errors.

---

### vectis config diff

Shows pending configuration changes as a diff.

```bash
vectis config diff
```

**Example output:**

```
Configuration changes detected:

  postfix/main.cf:
    - smtpd_tls_security_level = may
    + smtpd_tls_security_level = encrypt

  rspamd/local.d/actions.conf:
    - reject = 15;
    + reject = 12;

Service actions required:
  postfix:   reload
  rspamd:    reload
  dovecot:   no change
  clamav:    no change
  traefik:   no change

Run 'vectis config apply' to apply these changes.
```

**Exit codes:** `0` = no changes, `1` = changes pending, `2` = validation error.

---

### vectis config apply

Applies configuration changes: regenerates config files and triggers the appropriate service reloads or restarts.

```bash
vectis config apply
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Equivalent to `vectis config diff`. |

**Exit codes:** `0` = applied successfully, `1` = partial failure, `2` = validation failed (no changes made).

---

### vectis config get

Displays a specific configuration value.

```bash
vectis config get hostname
vectis config get rspamd.spam_threshold
```

---

### vectis config set

Sets a configuration value in `config.yaml`.

```bash
vectis config set rspamd.spam_threshold 12.0
```

The change is written to `config.yaml` but not applied until you run `vectis config apply`.

## Domain management

### vectis domain add

Adds a new domain.

```bash
vectis domain add --name example.com
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--name DOMAIN` | Domain name (required). |
| `--spam-threshold N` | Per-domain Rspamd score threshold. |
| `--max-mailboxes N` | Maximum number of mailboxes. |
| `--no-dkim` | Skip DKIM key generation. |

**Example output:**

```
Domain example.com created.

Add this DNS TXT record for DKIM:
  Name:  202604._domainkey.example.com
  Value: v=DKIM1; k=rsa; p=MIIBIjANBgkqh...

Also ensure these DNS records exist:
  SPF:   v=spf1 mx a ip4:203.0.113.10 -all
  DMARC: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com

Check deliverability: vectis domain check example.com
```

---

### vectis domain remove

Removes a domain. Fails if mailboxes or aliases still exist.

```bash
vectis domain remove --name example.com
```

---

### vectis domain list

Lists all domains.

```bash
vectis domain list
vectis domain list --active-only
vectis domain list --json
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--active-only` | Show only active domains. |
| `--format table\|json` | Output format. |

---

### vectis domain check

Runs deliverability checks (SPF, DKIM, DMARC, PTR, TLS) for a domain.

```bash
vectis domain check example.com
```

## Mailbox management

### vectis mailbox add

Creates a new mailbox.

```bash
vectis mailbox add --email alice@example.com --display-name "Alice Johnson" --quota 2048
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--email ADDRESS` | Full email address (required). |
| `--password PASS` | Password. If omitted, you are prompted securely. |
| `--display-name NAME` | Full name of the mailbox owner. |
| `--quota MB` | Quota in megabytes (default 1024). |

---

### vectis mailbox remove

Deletes a mailbox.

```bash
vectis mailbox remove --email alice@example.com
```

---

### vectis mailbox list

Lists mailboxes for a domain.

```bash
vectis mailbox list --domain example.com
vectis mailbox list --domain example.com --json
```

## Log viewing

### vectis logs

Streams logs from a specific service.

```bash
vectis logs postfix
vectis logs dovecot --tail 100
vectis logs rspamd --since "2026-04-04T00:00:00Z" --follow
```

**Arguments:** Service name (required). Valid services: `postfix`, `dovecot`, `rspamd`, `clamav`, `postgres`, `valkey`, `api`, `traefik`, `orchestrator`.

**Flags:**

| Flag | Description |
|------|-------------|
| `--tail N` | Show last N lines. |
| `--since TIMESTAMP` | Show logs since this time. |
| `--until TIMESTAMP` | Show logs until this time. |
| `--follow` | Stream new log lines (like `tail -f`). |

## Update commands

### vectis update plan

Checks for available updates and generates an update plan.

```bash
vectis update plan
```

**Example output:**

```
Update plan generated:

  Container changes:
    postfix:   1.2.0 -> 1.3.0
    rspamd:    3.8.0 -> 3.9.0
    api:       0.4.0 -> 0.5.0

  Database migrations:
    042_add_quota_tracking (non-destructive)
    043_add_audit_log_indexes (non-destructive)

  Config changes:
    postfix/main.cf will be regenerated

  No destructive operations.

  Run 'vectis update apply' to execute this plan.
  Plan expires if system state changes before apply.
```

---

### vectis update apply

Executes the stored update plan. Takes a database snapshot before applying.

```bash
vectis update apply
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--force` | Generate a plan and apply it in one step (no prior plan required). |

**Exit codes:** `0` = success, `1` = failed but rollback succeeded, `2` = failed and rollback also failed (manual intervention required).

---

### vectis update rollback

Rolls back the last update to the previous snapshot.

```bash
vectis update rollback
```

**Exit codes:** `0` = rollback successful, `1` = rollback failed (critical).

---

### vectis update self

Updates the Vectis CLI binary, orchestrator, and API containers.

```bash
vectis update self
```

## Backup commands

### vectis backup create

Creates a full backup archive containing the database dump, mail data, configuration, and DKIM keys.

```bash
vectis backup create
vectis backup create --output /path/to/backup.tar.gz
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--output PATH` | Custom backup path. Default: `/var/vectis/backups/vectis-YYYYMMDD-HHMMSS.tar.gz`. |

**Example output:**

```
Creating backup...
  [1/4] Database dump... done (12 MB)
  [2/4] Mail data... done (2.3 GB, 4,812 files)
  [3/4] Configuration... done
  [4/4] DKIM keys... done

Backup saved: /var/vectis/backups/vectis-20260404-120000.tar.gz (2.4 GB)
```

---

### vectis backup list

Lists available backup archives.

```bash
vectis backup list
```

---

### vectis backup restore

Restores from a backup archive. This is a destructive operation that stops all services, replaces all data, and restarts.

```bash
vectis backup restore /var/vectis/backups/vectis-20260404-120000.tar.gz --confirm
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--confirm` | Required to proceed. Prevents accidental restores. |

**Exit codes:** `0` = restore complete, `1` = restore failed.

## Command summary

| Command | Description |
|---------|-------------|
| `vectis preflight` | Run pre-flight system checks. |
| `vectis install` | Install Vectis on a fresh server. |
| `vectis serve` | Start the API server. |
| `vectis status` | Show service status. |
| `vectis health` | Show detailed health checks. |
| `vectis config get KEY` | Get a config value. |
| `vectis config set KEY VALUE` | Set a config value. |
| `vectis config validate` | Validate configuration files. |
| `vectis config diff` | Show pending config changes. |
| `vectis config apply` | Apply config changes. |
| `vectis domain add` | Add a domain. |
| `vectis domain remove` | Remove a domain. |
| `vectis domain list` | List domains. |
| `vectis domain check` | Run deliverability checks. |
| `vectis mailbox add` | Create a mailbox. |
| `vectis mailbox remove` | Delete a mailbox. |
| `vectis mailbox list` | List mailboxes. |
| `vectis logs SERVICE` | View service logs. |
| `vectis update plan` | Check for updates. |
| `vectis update apply` | Apply an update plan. |
| `vectis update rollback` | Roll back the last update. |
| `vectis update self` | Update the Vectis binary. |
| `vectis backup create` | Create a backup. |
| `vectis backup list` | List backups. |
| `vectis backup restore` | Restore from a backup. |

## Related

- [CLI Overview](/docs/cli/) -- installation and global flags
- [API Overview](/docs/api/) -- the REST API served by `vectis serve`
- [Architecture Overview](/docs/architecture/overview) -- system design
