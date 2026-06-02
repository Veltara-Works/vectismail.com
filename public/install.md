# Install — Vectis Mail

Machine-readable installation summary for AI agents and operators.
Full installation guide: https://vectismail.com/getting-started/installation/
Last updated: 2026-05-18

---

## System requirements

| Profile | Minimum | Recommended | Notes |
|---|---|---|---|
| **Dev / test** | 2 vCPU · 4 GB RAM · 40 GB SSD | — | Works for low-volume personal use; observability stack may strain memory |
| **Production small** | 2 vCPU · 4 GB RAM · 40 GB SSD | 4 vCPU · 8 GB RAM · 80 GB SSD | Up to a few thousand emails/day |
| **Production standard** | 4 vCPU · 8 GB RAM · 80 GB SSD | 4 vCPU · 8 GB RAM · 100 GB SSD | The published baseline. Comfort zone for Rspamd, ClamAV, full observability |
| **Production heavy** | 8 vCPU · 16 GB RAM · 200 GB SSD | 8 vCPU · 16 GB RAM · 500 GB SSD | High-volume sending, hundreds of mailboxes |

- **OS:** Ubuntu 22.04 LTS or 24.04 LTS (other Linux distros with Docker may work — not officially supported yet)
- **Docker:** version 24+ with Docker Compose v2
- **Network:** ports 25, 80, 443, 465, 587, 993, 995 open inbound; outbound 25, 53, 80, 443
- **DNS control** required (for MX, SPF, DKIM, DMARC, ACME challenge)
- **Cloudflare** account optional — used for DNS-01 ACME if you proxy your domain through CF (recommended for TLS automation)

## 10-line install on a fresh Ubuntu VPS

```bash
# 1. Download the installer (does NOT install — just unpacks the binary + templates)
curl -fsSL https://dl.vectismail.com/install.sh | bash

# 2. Edit your config (domains, MX, SMTP smarthost if any)
sudo nano /etc/vectis/config.yaml

# 3. Run the install — this is the step that actually deploys containers
sudo vectis install

# 4. Create your first mailbox (or use the admin UI)
sudo vectis mailbox add admin@yourdomain.com

# 5. Visit the admin UI at https://mail.yourdomain.com and log in
```

The `install.sh` downloads the Vectis binary + config templates. The `vectis install` step is what actually:

1. Sets up `/var/vectis/`, `/etc/vectis/`, and `/var/lib/vectis/`
2. Generates Postfix, Dovecot, Rspamd, Traefik configs from your `config.yaml`
3. Pulls Docker images from `ghcr.io/veltara-works/vectis-*`
4. Generates DKIM keys for every domain in your config
5. Starts the 14-container stack via Docker Compose
6. Runs database migrations to initialise Postgres
7. Health-checks every service and reports status

## DNS records you'll need to add

For each domain you put in `config.yaml`, the `vectis install` step prints the DNS records you must publish. Typical:

| Record type | Host | Value | Required for |
|---|---|---|---|
| **MX**     | `yourdomain.com`           | `10 mail.yourdomain.com`            | Receiving mail |
| **A**      | `mail.yourdomain.com`      | `<your VPS IP>`                     | Server reachable |
| **TXT (SPF)** | `yourdomain.com`        | `v=spf1 ip4:<your VPS IP> mx ~all`  | Outbound authentication |
| **TXT (DKIM)** | `<selector>._domainkey.yourdomain.com` | Vectis-generated public key | Outbound authentication |
| **TXT (DMARC)** | `_dmarc.yourdomain.com`| `v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com` | Authentication policy |
| **PTR (reverse)** | `<your VPS IP>` (set with your VPS provider) | `mail.yourdomain.com` | Inbox delivery rates |

Vectis verifies all of the above from the admin UI's Deliverability section after publication.

## Upgrade path

```bash
# Update to the latest stable
sudo vectis update

# Or pin a specific version
sudo vectis update --version v0.1.12
```

`vectis update` runs the 6-phase atomic orchestrator: snapshot → migrate → pull → deploy → health-check → complete. If any phase fails, the previous state is restored automatically.

## Pro license activation

1. Buy a Pro subscription at https://validonx.com/checkout/vectis-pro
2. ValidonX emails you four credentials: `tenant_id`, `license_key`, `service_key`, and (optionally) `subscription_id`
3. Paste into the admin UI at `https://mail.yourdomain.com/admin/license`
4. Pro features unlock within seconds; the license cache refreshes every 5 minutes

## Backup

Backups run automatically via the orchestrator. To create an ad-hoc backup:

```bash
sudo vectis backup create
```

Output is an AES-256-GCM encrypted tarball at `/var/lib/vectis/backups/`. Restore with:

```bash
sudo vectis backup restore <backup-id>
```

See the disaster-recovery runbook in the operator docs: https://github.com/Veltara-Works/vectis/blob/main/docs/notes/disaster-recovery-runbook.md

## Verification post-install

After install, verify:

- **Health:** `https://mail.yourdomain.com/api/v1/health` returns 200 with `status: healthy`
- **Send a test message:** admin UI → Mailboxes → click any mailbox → "Send test"
- **External delivery:** send to a gmail.com / outlook.com address and check `Authentication-Results: dkim=pass spf=pass dmarc=pass`
- **Container status:** `sudo docker ps` shows all 14 (or 10) `vectis-*` containers as `(healthy)`

## Common install gotchas

- **Outbound port 25 blocked** — many VPS providers (DigitalOcean, GCP, AWS) block port 25 by default. Open a support ticket BEFORE you finish the install.
- **Reverse DNS (PTR)** — most providers require a ticket to set this. Configure it before going live or your outbound mail goes to spam.
- **Cloudflare proxying mail.<domain>** — turn off the proxy (grey-cloud) for the `mail.` subdomain; Cloudflare doesn't proxy SMTP and breaks STARTTLS.
- **First-message greylisting** — Rspamd's default greylisting delays the first message from new senders by 5 minutes. Expected behaviour; adjust per-domain in Pro.

## Uninstall

```bash
sudo vectis uninstall
```

Stops all containers, removes networks, and offers to wipe `/var/lib/vectis/` (data) and `/etc/vectis/` (config). Backups in `/var/lib/vectis/backups/` are retained by default unless you confirm full removal.

## Related files

- Full install guide: https://vectismail.com/getting-started/installation/
- Architecture overview: https://vectismail.com/architecture/overview/
- [llms.txt](https://vectismail.com/llms.txt) — AI-agent overview
- [security.md](https://vectismail.com/security.md) — security posture
- [api.md](https://vectismail.com/api.md) — API summary post-install
