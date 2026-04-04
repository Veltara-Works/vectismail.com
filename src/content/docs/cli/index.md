---
title: "CLI Overview"
description: "Introduction to the Vectis CLI, installation lifecycle, global flags, and how the CLI relates to the API server."
---

The `vectis` CLI is a single Go binary that serves as both the command-line management tool and the API server. It is the primary interface for installing, configuring, and operating a Vectis mail server.

## What the CLI does

The `vectis` binary has two operating modes:

- **`vectis serve`** -- starts the Go API server, which serves the REST API and the admin dashboard.
- **All other subcommands** -- perform CLI operations like installation, configuration management, domain and mailbox management, updates, and backups.

The CLI outputs human-readable text by default. All commands support a `--json` flag for structured JSON output, making it suitable for scripting and CI/CD pipelines.

## Installation

The Vectis binary is distributed as a single static Go binary. On a fresh Ubuntu server:

```bash
# Download the latest release
curl -fsSL https://releases.vectismail.com/latest/vectis-linux-amd64 -o /usr/local/bin/vectis
chmod +x /usr/local/bin/vectis

# Verify installation
vectis --version
```

Or install from source:

```bash
git clone https://github.com/Veltara-Works/vectis.git
cd vectis
go build -o /usr/local/bin/vectis ./cmd/vectis/
```

## Two-step lifecycle: preflight + install

Setting up a new Vectis server follows a two-step process:

### Step 1: Preflight checks

Run `vectis preflight` to validate the server environment without making any changes. It checks the operating system, CPU, RAM, disk space, network ports, DNS resolution, Docker availability, and outbound SMTP connectivity.

```bash
vectis preflight
```

If any checks fail, the output includes specific fix instructions for each issue. Re-run preflight after fixing the issues.

### Step 2: Install

Once preflight passes, run `vectis install` to perform the full installation. The installer can run interactively (prompting for hostname, admin email, initial domain) or unattended with pre-written config files.

**Interactive:**

```bash
vectis install
```

**Unattended:**

```bash
vectis install --config /path/to/config.yaml --secrets /path/to/secrets.yaml
```

The installer performs these steps:

1. Installs Docker Engine and Docker Compose (if not present).
2. Configures Docker (log rotation, IPv6 support).
3. Generates `config.yaml` and `secrets.yaml` at `/etc/vectis/`.
4. Generates `docker-compose.yml`.
5. Pulls all container images.
6. Starts all services.
7. Runs database migrations.
8. Runs health checks.
9. Prints the admin URL, initial credentials, and next steps.

## Global flags

All commands support these flags:

| Flag | Description |
|------|-------------|
| `--json` | Output structured JSON instead of human-readable text. |
| `--quiet` | Suppress non-essential output. Only errors and the final result are shown. |
| `--verbose` | Show detailed debug output. |
| `--config-dir PATH` | Override the default config directory (default: `/etc/vectis/`). |
| `--help` | Show help for the command. |
| `--version` | Show the Vectis CLI version. |

## Exit codes

Exit codes are consistent across all commands:

| Code | Meaning |
|------|---------|
| `0` | Success. |
| `1` | Failure (details in output). |
| `2` | Validation error or invalid input. |

## JSON output mode

When `--json` is set, every command outputs a JSON object to stdout. This is useful for scripting and automation:

```bash
# Parse domain list in a script
vectis domain list --json | jq '.domains[].name'

# Check status programmatically
vectis status --json | jq '.services[] | select(.status != "healthy")'
```

## Config file locations

| File | Default path | Description |
|------|-------------|-------------|
| `config.yaml` | `/etc/vectis/config.yaml` | Infrastructure policy and settings. |
| `secrets.yaml` | `/etc/vectis/secrets.yaml` | Database passwords, API secrets, DKIM keys. Mode `0600`. |

Both paths can be overridden with `--config-dir`.

## Next steps

- [CLI Commands](/cli/commands) -- full reference for every command
- [API Overview](/api/) -- the REST API that `vectis serve` provides
- [Architecture Overview](/architecture/overview) -- how the components fit together
