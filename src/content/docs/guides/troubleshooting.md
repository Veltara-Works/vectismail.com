---
title: "Troubleshooting"
description: "Common issues and solutions for Vectis Mail. Diagnose mail delivery failures, spam classification, TLS certificate problems, authentication errors, DNS misconfigurations, Postfix queue issues, Dovecot connection failures, and container crashes."
---

This guide covers the most common issues you will encounter running a Vectis Mail server, with concrete diagnostic steps and solutions. Start with [checking service health](#checking-service-health), then find your specific issue below.

## Checking service health

Before diving into specific issues, check the overall state of your server:

```bash
# Quick status of all services
vectis status

# Detailed health checks
vectis health

# Docker-level container status
docker compose ps
```

A healthy server shows all services as `healthy` with reasonable uptime. If a service is `unhealthy` or `restarting`, start with its logs:

```bash
# Vectis CLI (recommended)
vectis logs postfix --tail 100
vectis logs dovecot --tail 100

# Docker logs (alternative)
docker logs vectis-postfix --tail 100
docker logs vectis-dovecot --tail 100
```

## Mail not delivering to external recipients

**Symptom**: Messages sent from your server are not arriving at Gmail, Outlook, Yahoo, or other providers.

### Step 1: Check the Postfix queue

```bash
# Show the mail queue
docker exec vectis-postfix mailq

# Or via the Vectis CLI
vectis logs postfix --tail 200
```

If the queue contains messages, look at the reason for each deferred message. Common reasons:

| Queue message | Cause | Solution |
|---------------|-------|----------|
| `Connection timed out` | Port 25 outbound is blocked | Contact your VPS provider to unblock outbound SMTP |
| `421 Try again later` | Recipient server rate limiting | Normal during IP warmup; wait and retry |
| `550 5.7.1 Rejected` | SPF/DKIM failure or IP blocklisted | Check authentication records and RBL status |
| `Host or domain name not found` | DNS resolution failure | Check `/etc/resolv.conf` inside the container |

### Step 2: Verify port 25 is open outbound

Many VPS providers block outbound port 25 by default to prevent spam. Test from your server:

```bash
# Test outbound connectivity
telnet gmail-smtp-in.l.google.com 25

# If telnet is not available
nc -zv gmail-smtp-in.l.google.com 25
```

If the connection times out, contact your VPS provider to unblock port 25. This is the single most common issue with new mail servers.

### Step 3: Check DNS authentication

```bash
vectis domain check example.com
```

If SPF, DKIM, or DMARC are failing, see the [DKIM, SPF & DMARC guide](/guides/dkim-spf-dmarc).

### Step 4: Check IP reputation

```bash
# Check RBL status via API
curl https://mail.example.com/api/v1/deliverability/rbl \
  -H "Authorization: Bearer YOUR_TOKEN"
```

If your IP is listed on any RBL, follow the delisting process for that specific list. See [deliverability best practices](/guides/deliverability) for details.

## Mail not delivering to your server

**Symptom**: External senders report that their messages bounce when sending to your domain.

### Step 1: Check MX records

```bash
dig MX example.com +short
```

The MX record must point to your mail hostname (e.g., `mail.example.com`), and the hostname must resolve to your server's IP.

### Step 2: Check port 25 is open inbound

```bash
# From another machine, test connectivity
nc -zv mail.example.com 25

# Or use telnet
telnet mail.example.com 25
```

If the connection is refused, check:
- Firewall rules on your server (`ufw status` or `iptables -L`)
- VPS provider firewall/security group settings
- That the Postfix container is running (`docker compose ps`)

### Step 3: Check Postfix is accepting mail for the domain

```bash
vectis logs postfix --tail 200
```

Look for `NOQUEUE: reject` lines. Common causes:

| Log message | Cause | Solution |
|-------------|-------|----------|
| `Recipient address rejected: User unknown` | Mailbox does not exist | Create the mailbox or check the address |
| `Relay access denied` | Domain not in virtual_mailbox_domains | Verify the domain is added and active in Vectis |
| `Client host rejected` | IP blocked by Postfix restrictions | Check `smtpd_recipient_restrictions` |

### Step 4: Check Cloudflare proxy status

If you use Cloudflare, make sure the mail hostname A record is DNS-only (grey cloud, not orange). See the [Cloudflare guide](/guides/cloudflare).

```bash
# Verify the A record returns your IP, not Cloudflare's
dig A mail.example.com +short
```

## Messages going to spam

**Symptom**: Your email arrives but lands in the recipient's spam folder.

### Check authentication headers

Send a test email to a Gmail address. Open it (check the spam folder), click the three dots, and select "Show original". Look for:

```
Authentication-Results:
  spf=pass
  dkim=pass
  dmarc=pass
```

If any of these show `fail`, fix the corresponding DNS record.

### Check your spam score

Send a test to [mail-tester.com](https://www.mail-tester.com). A score below 7/10 indicates problems. The report will tell you exactly what is wrong.

### Common spam triggers

- No PTR record or PTR mismatch
- IP on an RBL
- SPF using `~all` instead of `-all`
- DMARC policy set to `p=none`
- HTML-only email with no plain text alternative
- Spammy content (excessive capitalisation, multiple exclamation marks)
- New IP without warmup (see [IP warmup guide](/guides/ip-warmup))

## TLS certificate issues

### Certificate not found on startup

**Symptom**: Postfix or Dovecot fail to start. Logs show `cannot load certificate` or `SSL certificate not found`.

```bash
# Check acme.sh sidecar logs
vectis logs acme --tail 50
docker logs vectis-acme --tail 50

# Verify certificate files exist
docker exec vectis-postfix ls -la /etc/ssl/mail/
```

**Common causes**:
- The acme.sh sidecar has not completed initial certificate issuance
- Port 80 is not reachable (required for HTTP-01 challenges)
- DNS-01 challenge is misconfigured (wrong Cloudflare API token)

**Solution**: Check the acme.sh logs for the specific error. If using HTTP-01, ensure port 80 is open. If using DNS-01, verify the Cloudflare API token in `secrets.yaml`.

### Certificate expired

**Symptom**: Email clients show certificate warnings. TLS connections fail with `certificate has expired`.

```bash
# Check certificate expiry
docker exec vectis-postfix openssl x509 -in /etc/ssl/mail/fullchain.pem -noout -dates

# Force renewal
docker exec vectis-acme acme.sh --renew --domain mail.example.com --force
```

### Certificate hostname mismatch

**Symptom**: Email clients show "certificate does not match hostname" warnings.

```bash
# Check the certificate's CN and SAN
docker exec vectis-postfix openssl x509 -in /etc/ssl/mail/fullchain.pem -noout -text | grep -A1 "Subject:"
```

The certificate's Common Name (CN) or Subject Alternative Name (SAN) must match the hostname your clients connect to. If you changed your mail hostname after installation, you need to reissue the certificate.

## Authentication failures

### IMAP/SMTP login fails

**Symptom**: Email client shows "authentication failed" when trying to log in.

```bash
# Check Dovecot auth logs
vectis logs dovecot --tail 100
```

**Common causes**:

| Log message | Cause | Solution |
|-------------|-------|----------|
| `auth failed` with no password hash | Mailbox does not exist | Verify the mailbox exists: `vectis mailbox list` |
| `password mismatch` | Wrong password | Reset the password via dashboard or API |
| `plaintext auth disabled` | Client connecting without TLS | Configure the client to use SSL/TLS (port 993 for IMAP, 587 for SMTP) |

### Admin dashboard login fails

**Symptom**: Cannot log into the Vectis admin dashboard.

```bash
# Check API logs for auth errors
vectis logs api --tail 100
```

If you have forgotten the admin password, you can reset it:

```bash
# Via CLI (if you have SSH access)
vectis admin reset-password --email admin@example.com
```

### TOTP issues

If TOTP (two-factor authentication) is enabled and your authenticator app is out of sync:

- Verify your device clock is accurate (TOTP is time-based)
- Use backup codes if available
- As a last resort, disable TOTP via the API with a valid TOTP code

## DNS problems

### DNS propagation delays

After changing DNS records, allow time for propagation:

- Cloudflare: typically 1-5 minutes
- Other providers: up to 24-48 hours

Check current DNS state with:

```bash
# Query a specific DNS server (bypasses local cache)
dig @8.8.8.8 MX example.com +short
dig @1.1.1.1 TXT example.com +short
```

### Split DNS / internal resolution

If your server cannot resolve its own hostname, check the DNS resolver configuration inside the container:

```bash
docker exec vectis-postfix cat /etc/resolv.conf
```

Docker containers typically use the host's DNS configuration. If your host is configured with an internal DNS server that does not have your public records, outbound mail may fail to resolve recipient domains.

## Postfix queue stuck

**Symptom**: Messages are stuck in the queue and not being delivered.

```bash
# View the queue
docker exec vectis-postfix mailq

# Force queue flush (attempt immediate delivery)
docker exec vectis-postfix postqueue -f

# View a specific queued message
docker exec vectis-postfix postcat -q MESSAGE_ID
```

### Clearing the queue

If the queue contains messages that will never be delivered (e.g., invalid recipients from a misconfiguration):

```bash
# Delete all deferred messages
docker exec vectis-postfix postsuper -d ALL deferred

# Delete a specific message
docker exec vectis-postfix postsuper -d MESSAGE_ID
```

Use this carefully -- deleting queued messages means those emails will never be delivered.

## Dovecot connection refused

**Symptom**: IMAP clients cannot connect. Connection is refused on port 993.

```bash
# Check if Dovecot is running
docker compose ps | grep dovecot

# Check Dovecot logs
vectis logs dovecot --tail 100

# Test the port locally
docker exec vectis-dovecot ss -tlnp | grep 993
```

**Common causes**:

- Dovecot container has crashed (check logs for the reason)
- Port 993 is blocked by a firewall
- TLS certificate is missing or invalid (Dovecot requires a valid cert to start with `ssl = required`)

## High memory usage

**Symptom**: Server running slowly or services being OOM-killed.

```bash
# Check per-container memory usage
docker stats --no-stream

# Check system memory
free -h
```

**Typical memory usage:**

| Service | Normal range | Notes |
|---------|-------------|-------|
| Postfix | 30-80 MB | Increases with queue size |
| Dovecot | 50-200 MB | Scales with concurrent IMAP connections |
| Rspamd | 200-500 MB | Neural network and Bayes classifier |
| ClamAV | 800 MB - 1.5 GB | Virus signature database |
| Postgres | 100-300 MB | Depends on shared_buffers config |
| Valkey | 30-100 MB | Depends on cached data |
| Traefik | 30-60 MB | Minimal |
| Go API | 20-60 MB | Minimal |

**If ClamAV is consuming too much memory**, consider switching to a lighter profile or disabling it:

```yaml
# In config.yaml
clamav:
  profile: none  # Disables ClamAV entirely
```

Then apply:

```bash
vectis config apply
```

## Docker container crashes

**Symptom**: A container is restarting in a loop.

```bash
# Check container state
docker compose ps

# Check the exit code and restart count
docker inspect vectis-postfix --format='{{.State.ExitCode}} {{.RestartCount}}'

# Check logs for the crash reason
docker logs vectis-postfix --tail 200
```

**Common crash causes:**

| Container | Typical crash reason | Solution |
|-----------|---------------------|----------|
| Postfix | Invalid `main.cf` configuration | Run `vectis config validate` and fix errors |
| Dovecot | Missing TLS certificate | Ensure acme.sh has issued certificates |
| Rspamd | Corrupted neural network data | Delete Rspamd data volume and restart |
| ClamAV | Out of memory during signature update | Increase memory limits or disable ClamAV |
| Postgres | Corrupted data files | Restore from backup: `vectis backup restore` |

### Restarting a single service

```bash
# Restart a specific container
docker compose restart postfix

# Or stop and start
docker compose stop dovecot
docker compose start dovecot
```

### Restarting all services

```bash
# Restart everything
docker compose restart

# Nuclear option: stop all, remove containers, start fresh
docker compose down
docker compose up -d
```

## Collecting diagnostic information

If you need to file a support request or investigate a complex issue, collect this information:

```bash
# System info
vectis status --json > /tmp/vectis-status.json

# All service logs (last 500 lines each)
vectis logs postfix --tail 500 > /tmp/postfix.log 2>&1
vectis logs dovecot --tail 500 > /tmp/dovecot.log 2>&1
vectis logs rspamd --tail 500 > /tmp/rspamd.log 2>&1
vectis logs api --tail 500 > /tmp/api.log 2>&1

# DNS check
vectis domain check example.com --json > /tmp/dns-check.json 2>&1

# Docker stats snapshot
docker stats --no-stream > /tmp/docker-stats.txt
```

## Next steps

- [Installation guide](/getting-started/installation) for initial server setup
- [DNS setup](/getting-started/dns-setup) for record configuration
- [TLS certificates](/guides/tls-certificates) for certificate management
- [Deliverability best practices](/guides/deliverability) for inbox placement
