---
title: Installation
description: Step-by-step install of Vectis Mail on a fresh Ubuntu VPS.
---

This guide walks through a fresh install on a clean Ubuntu 24.04 VPS. The full path is **prerequisites → download → install → publish DNS records**, and the `curl | sudo bash` one-liner is interactive — you'll be prompted to confirm the hostname and admin email it auto-detects from your VPS's reverse DNS.

## Prerequisites

Before running the installer, make sure your VPS is in the right state.

### 1. Enable SSH access to the VPS

Many VPS providers (BinaryLane and Hetzner among them) ship Ubuntu images with password-based SSH disabled — `/etc/ssh/sshd_config` ships with `PermitRootLogin prohibit-password`, and no non-root user is created. If you try to `ssh root@your-vps` immediately after provisioning, the connection will be refused.

You have two options:

**(a) Add your SSH public key at the provider's panel.** Most providers let you paste a key into the VPS config before (or shortly after) it boots. With the key installed, `ssh root@your-vps` works immediately, and nothing else is needed here.

**(b) Use the provider's web console to create a sudo user and enable password SSH.** Open the web console (BinaryLane calls it "VNC"; DigitalOcean "Droplet Console"), log in as root with the initial password the provider emailed you, then:

```bash
# Create a non-root user with sudo
adduser vectis
usermod -aG sudo vectis

# Allow password-based SSH for this user (optional — key-based is preferred)
# Edit /etc/ssh/sshd_config: set "PasswordAuthentication yes"
sudo systemctl reload ssh
```

You only need this step once. Everything else in this guide assumes you can SSH into the box.

### 2. Update the OS

On a fresh VPS, bring the base packages up to date:

```bash
sudo apt update && sudo apt upgrade -y
```

If a kernel upgrade is included, **reboot before continuing**:

```bash
sudo reboot
```

### 3. Set reverse DNS (PTR) at your VPS provider

PTR (reverse DNS) is a **hard requirement**, not a nice-to-have. Without a matching PTR record, your outbound mail will be rejected as spam by Gmail, Outlook, and most receiving servers — *and* the deliverability check in the Setup Wizard will fail.

Do this at your VPS provider's control panel (BinaryLane, Hetzner, DigitalOcean, etc.) — **not** at your DNS registrar. Some providers expose it as a simple field; others require a one-time support request (same channel as the port 25 unblock below). The PTR record for your server's public IPv4 should resolve to the FQDN you intend to use for mail (e.g. `mail.example.com`).

Verify it from any machine once set:

```bash
# Expect output like: 203.0.113.10.in-addr.arpa name = mail.example.com.
dig -x YOUR_SERVER_IP +short
```

The installer looks this up for you and, if it resolves, pre-fills your mail-server hostname automatically — you just press Enter. If PTR isn't set when you run the installer, you'll have to type the hostname manually and fix the PTR afterwards.

### 4. Request port 25 unblock

Most VPS providers block outbound port 25 by default to prevent spam abuse. Without it, your server can send to itself but not to anyone else. Check your provider's documentation for "SMTP unblock" or "port 25 unblock" — usually a one-time support request.

### System requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| **OS** | Ubuntu 24.04 LTS | Ubuntu 24.04 LTS |
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB (without ClamAV) | 4 GB+ |
| **Disk** | 30 GB SSD allocation (~20 GB free after OS install) | 100 GB+ SSD |
| **Inbound ports** | 25, 80, 443, 465, 587, 993, 995 | + IPv6 |

Docker is installed automatically by the script if it isn't already present.

## Download

Run the one-liner. It downloads the binary, installs Docker if needed, seeds randomly-generated secrets, and prompts you to confirm the hostname.

```bash
curl -fsSL https://get.vectismail.com | sudo bash
```

You'll see prompts like:

```
[INFO] Detected public IPv4: 203.0.113.10
[INFO] Reverse DNS (PTR): mail.example.com
Mail server hostname [mail.example.com]:
TLS / admin email [admin@example.com]:
```

Press Enter to accept the defaults the script detected, or type to override. If your VPS doesn't have PTR set, the prompt defaults to a placeholder and you'll need to type your FQDN manually.

When the script finishes you'll see:

```
========================================================
 Vectis downloaded successfully
========================================================

  The binary is in place but nothing is running yet. Next steps:

    1. Review /etc/vectis/config.yaml (hostname: mail.example.com)
    2. vectis preflight    # verify system + ports + DNS
    3. vectis install      # deploy containers, run migrations, create admin
```

This step **only puts the binary on disk** — it doesn't start anything. The next two steps do.

### What if I want to run it non-interactively?

Pipe the script with no TTY (e.g. unattended cloud-init), and it'll skip the prompts. It writes the detected PTR if there is one, or leaves the placeholder for you to edit `/etc/vectis/config.yaml` by hand. The next step (`vectis install`) will refuse to proceed if it finds the placeholder.

## Preflight

Verify the system is ready:

```bash
vectis preflight
```

This checks OS version, CPU/RAM, port availability (25, 80, 443, 465, 587, 993, 995), outbound port 25 reachability, Docker version. Anything red here will block install — fix and re-run.

## Install

```bash
vectis install
```

This is the heavy lift — about 11 steps over 1-3 minutes depending on your network speed. It generates service configs, writes the docker-compose file, pulls all images, brings Postgres up first and waits for it to be healthy, runs database migrations, creates the initial admin account, then starts the rest of the stack.

When it finishes you'll see:

```
═══════════════════════════════════════════
  Vectis is ready!

  Admin URL:      https://mail.example.com/admin
  Admin email:    admin@example.com
  Admin password: a3f9c2b1e5d7891f

  !! SAVE THE PASSWORD ABOVE — it is shown only here, it is
     not written to disk, and it will not be recoverable.
     Change it immediately after your first login.

  DNS records you must publish now:
    ...
```

> **Copy the admin password before closing the terminal.** It is only ever shown here. The plaintext is not written to disk anywhere — only its bcrypt hash. If you're running the installer in a VPS-provider web terminal, scrollback may be limited or absent, so copy *immediately*.

### Lost the admin password?

If you closed the terminal before copying it, generate a new one with:

```bash
docker compose -f /etc/vectis/docker-compose.yml run --rm \
  --no-deps --entrypoint vectis api admin reset-password
```

Output includes the new password — copy it once and use it to log in.

## Publish DNS records

The install banner prints the records you need to publish. There are two destinations:

**At your domain registrar (or Cloudflare if your nameservers point there):**

```
A     mail.example.com.   →  203.0.113.10
```

If you also have IPv6 *and* the v6 PTR matches your hostname, the banner will additionally print an `AAAA` record. If your v6 PTR isn't set or doesn't match, the banner will explicitly tell you **not** to publish AAAA — Gmail and Outlook reject IPv6 mail with mismatched PTR.

**At your VPS provider's control panel (NOT the registrar):**

```
PTR   203.0.113.10   →  mail.example.com.
```

You should already have this set as a prerequisite. If you didn't, do it now — outbound mail will be rejected as spam without it.

The per-domain MX, SPF, DKIM, and DMARC records come from the **Setup Wizard** in the admin UI once you log in — those are scoped to each mail-domain you add (e.g. `example.com` if you want to send `you@example.com`), not the server's hostname.

## Verifying the install

```bash
# All containers healthy
vectis status

# Admin UI loads
# https://mail.example.com/admin
# (allow a minute or two for Let's Encrypt to issue the cert)
```

Once the cert has issued, opening the admin URL in your browser should show the login screen:

![Vectis Mail admin login screen](/screenshots/installation/01-login.png)

Sign in with the admin email and password from the banner. From here, the [Your First Domain](/getting-started/first-domain) guide walks through the Setup Wizard to add a domain and create your first mailbox.

If the admin URL refuses to connect from your laptop:

- Check the public IP path: `curl -v -4 http://YOUR_IP/` should reach Traefik (a 404 with `Host: localhost` is expected)
- If it doesn't, your VPS provider may have an inbound firewall — check their panel for any "Cloud Firewall" / "Network Firewall" / security group rules

## Configuration files

After install, your config lives in `/etc/vectis/`:

| File | Purpose |
|------|---------|
| `config.yaml` | System configuration (hostname, TLS, resources, features) |
| `secrets.yaml` | Credentials (database, API, DKIM paths, OIDC, ValidonX) |

The generated docker-compose file lives at `/etc/vectis/docker-compose.yml`, and the rendered service configs at `/var/vectis/generated/`.

Changes to `config.yaml` are applied via:

```bash
vectis config apply
```

This regenerates affected service configs and reloads the relevant containers.

## Next steps

- [Add your first domain](/getting-started/first-domain)
- [Configure DNS records](/getting-started/dns-setup) — the per-mail-domain records (MX, SPF, DKIM, DMARC)
