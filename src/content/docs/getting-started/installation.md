---
title: Installation
description: System requirements and step-by-step installation of Vectis Mail on a fresh server.
---

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 4 GB | 8 GB |
| **Disk** | 40 GB SSD | 100 GB SSD |
| **Network** | Public IPv4, ports 25/80/443/993/995 open | + IPv6 |
| **DNS** | MX, A, SPF, DKIM, DMARC records | + PTR (reverse DNS) |

Docker and Docker Compose are installed automatically by the Vectis installer.

## Quick Install

```bash
# Download the Vectis binary
curl -fsSL https://get.vectismail.com | sh

# Run preflight checks
vectis preflight

# Install (interactive — prompts for hostname, admin email, passwords)
vectis install
```

## What the installer does

1. **Preflight checks** — verifies OS, ports, DNS, Docker availability
2. **Generates secrets** — database passwords, API secret, cookie key, DKIM keys
3. **Writes config** — `config.yaml` and `secrets.yaml` to `/etc/vectis/`
4. **Runs the config engine** — generates Postfix, Dovecot, Rspamd, Traefik configs
5. **Starts Docker Compose** — pulls images and starts all containers
6. **Runs migrations** — creates the database schema
7. **Creates initial admin** — the admin account you'll use to log in

## Two-Step Install (Advanced)

For automated deployments, you can separate preflight from install:

```bash
# Step 1: Check prerequisites (exits non-zero on failure)
vectis preflight --strict

# Step 2: Install with pre-written config files
vectis install --config /etc/vectis/config.yaml --secrets /etc/vectis/secrets.yaml
```

## Verifying the Installation

```bash
# Check all services are healthy
vectis status

# Open the admin dashboard
# https://your-hostname/admin
# Log in with the admin email and password from installation
```

## Configuration Files

After installation, your config lives in `/etc/vectis/`:

| File | Purpose |
|------|---------|
| `config.yaml` | System configuration (hostname, TLS, resources, features) |
| `secrets.yaml` | Credentials (database, API, DKIM paths, OIDC, ValidonX) |
| `generated/` | Auto-generated service configs (do not edit manually) |

Changes to `config.yaml` are applied via:

```bash
vectis config apply
```

This regenerates all service configs and restarts affected containers.

## Next Steps

- [Add your first domain](/docs/getting-started/first-domain)
- [Configure DNS records](/docs/getting-started/dns-setup)
