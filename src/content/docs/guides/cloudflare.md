---
title: "Cloudflare Integration"
description: "How to use Cloudflare DNS with Vectis Mail. Covers MX and mail hostname records (DNS-only mode), SPF/DKIM/DMARC TXT records, DNS-01 challenges for TLS certificates, and common Cloudflare configuration mistakes."
---

Cloudflare is the most popular DNS provider for self-hosted mail servers. It works well with Vectis Mail, but there are critical configuration requirements -- most importantly, mail-related DNS records must NOT be proxied through Cloudflare. This guide covers everything you need to configure correctly.

## The golden rule: DNS-only for mail records

Cloudflare's proxy (the orange cloud icon) works by intercepting HTTP/HTTPS traffic and routing it through Cloudflare's network for CDN caching, DDoS protection, and WAF filtering. This is great for web traffic, but it breaks email.

Mail protocols (SMTP, IMAP, POP3) are not HTTP. They cannot pass through Cloudflare's proxy. If you proxy your mail hostname, email clients and other mail servers will connect to Cloudflare's IPs instead of your server, and the connections will fail.

**Every DNS record used by mail services must be set to DNS-only (grey cloud).**

## Required DNS records

Here is a complete Cloudflare DNS configuration for `example.com` on a Vectis server at `203.0.113.10`:

### A record for mail hostname

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| A | `mail` | `203.0.113.10` | **DNS only** (grey cloud) |

This is the most critical record. It must be DNS-only. If you turn on the proxy (orange cloud), SMTP, IMAP, and POP3 connections will all fail.

If you have IPv6:

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| AAAA | `mail` | `2001:db8::1` | **DNS only** (grey cloud) |

### MX record

| Type | Name | Content | Priority | Proxy status |
|------|------|---------|----------|-------------|
| MX | `@` (or `example.com`) | `mail.example.com` | 10 | N/A (MX cannot be proxied) |

MX records are not proxyable in Cloudflare -- there is no orange/grey cloud toggle. They always resolve directly.

### SPF record

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| TXT | `@` (or `example.com`) | `v=spf1 mx a ip4:203.0.113.10 -all` | N/A (TXT cannot be proxied) |

TXT records are always DNS-only. No action needed.

### DKIM record

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| TXT | `202604._domainkey` | `v=DKIM1; k=rsa; p=MIIBIjANBg...` | N/A (TXT cannot be proxied) |

Copy the full DKIM public key from the Vectis dashboard (**Domains** > your domain > **DKIM**). The key is a long base64 string -- paste it exactly as shown. Cloudflare handles long TXT records correctly and will split them into 255-byte chunks automatically.

### DMARC record

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1` | N/A (TXT cannot be proxied) |

### PTR record (reverse DNS)

PTR records are NOT set in Cloudflare. They are set at your VPS provider's control panel. Your VPS provider controls the reverse DNS for your IP address.

```bash
# Verify PTR record
dig -x 203.0.113.10 +short
# Should return: mail.example.com.
```

## Proxying the admin dashboard

The Vectis admin dashboard and API are served over HTTPS on your mail hostname. You might be tempted to proxy this for Cloudflare's DDoS protection, but since the same hostname is used for mail services, you must keep it DNS-only.

If you want Cloudflare proxy protection for the admin dashboard, you can set up a separate hostname:

| Type | Name | Content | Proxy status |
|------|------|---------|-------------|
| A | `admin` | `203.0.113.10` | **Proxied** (orange cloud) -- optional |
| A | `mail` | `203.0.113.10` | **DNS only** (grey cloud) -- required |

Then access the admin dashboard at `https://admin.example.com/admin` and keep `mail.example.com` for SMTP/IMAP/POP3.

Note: This requires additional Traefik configuration to accept traffic for both hostnames.

## DNS-01 challenges for TLS certificates

Cloudflare DNS is ideal for DNS-01 TLS certificate challenges. This method is useful when:

- Port 80 is blocked or restricted on your server
- You want to issue certificates before pointing DNS to your server
- You need wildcard certificates

### Setting up a Cloudflare API token

1. Log into the Cloudflare dashboard
2. Go to **My Profile** > **API Tokens** > **Create Token**
3. Use the **Edit zone DNS** template, or create a custom token with:
   - **Permissions**: Zone > DNS > Edit
   - **Zone Resources**: Include > Specific zone > `example.com`
4. Copy the generated token

### Configuring Vectis

Add the token to `/etc/vectis/secrets.yaml`:

```yaml
cloudflare:
  api_token: "your-cloudflare-api-token-here"
```

Set restrictive permissions on the file:

```bash
chmod 600 /etc/vectis/secrets.yaml
```

The acme.sh sidecar will use this token to create temporary `_acme-challenge` TXT records during certificate issuance and renewal, then clean them up automatically.

### Token security

The Cloudflare API token only needs DNS Edit permission for the specific zone. Do not use a Global API Key -- it grants full account access. Create a scoped token with the minimum permissions required.

## Cloudflare DNS settings to check

### DNSSEC

If you enable DNSSEC in Cloudflare (recommended for security), make sure the DS record is properly configured at your domain registrar. DNSSEC validation failures will cause DNS resolution failures for all records, including mail.

### Minimum TTL

Cloudflare free plans have a minimum TTL of 300 seconds (5 minutes) for DNS-only records. This is fine for mail -- DNS changes propagate quickly. During initial setup, use the lowest available TTL. After everything is working, you can increase it.

### Email routing

Cloudflare offers an "Email Routing" feature that forwards email to other addresses. **Do not enable this** if you are running Vectis Mail. Cloudflare Email Routing adds its own MX records that conflict with yours and will intercept inbound mail before it reaches your server.

If you see Cloudflare MX records like `route1.mx.cloudflare.net` in your DNS, Email Routing is enabled. Disable it under the **Email** tab in the Cloudflare dashboard.

## Verifying your configuration

After adding all records in Cloudflare, verify everything resolves correctly:

```bash
# Check A record resolves to your server IP (not Cloudflare)
dig A mail.example.com +short
# Expected: 203.0.113.10
# If you see a Cloudflare IP (104.x.x.x, 172.x.x.x), the record is proxied

# Check MX record
dig MX example.com +short
# Expected: 10 mail.example.com.

# Check SPF
dig TXT example.com +short
# Expected: "v=spf1 mx a ip4:203.0.113.10 -all"

# Check DKIM
dig TXT 202604._domainkey.example.com +short
# Expected: "v=DKIM1; k=rsa; p=MIIBIjANBg..."

# Check DMARC
dig TXT _dmarc.example.com +short
# Expected: "v=DMARC1; p=quarantine; ..."

# Full Vectis deliverability check
vectis domain check example.com
```

### How to tell if a record is proxied

When you run `dig A mail.example.com`, a DNS-only record returns your server's actual IP (e.g., `203.0.113.10`). A proxied record returns a Cloudflare IP in the `104.x.x.x` or `172.x.x.x` range. If you see a Cloudflare IP, your mail hostname is proxied and needs to be changed to DNS-only.

## Common Cloudflare mistakes

### Orange cloud on the mail hostname

**Symptom**: Email clients cannot connect. SMTP connections time out. Other servers cannot deliver mail to you.

**Fix**: In Cloudflare DNS, click the orange cloud next to your mail A record to toggle it to grey (DNS-only). Wait 5 minutes for propagation.

### Email Routing enabled

**Symptom**: Inbound mail is handled by Cloudflare instead of your server. MX records point to `route1.mx.cloudflare.net`.

**Fix**: Go to the **Email** section in Cloudflare and disable Email Routing. Delete any Cloudflare-managed MX records and add your own.

### Multiple SPF records

**Symptom**: SPF validation returns permerror. If Cloudflare Email Routing was previously enabled, it may have added its own SPF include.

**Fix**: Ensure you have exactly one SPF TXT record on your domain. Remove any `include:_spf.mx.cloudflare.net` references if present.

### DKIM key truncated

**Symptom**: DKIM verification fails despite the record being present.

**Fix**: Cloudflare supports long TXT records, but some copy-paste operations truncate the value. Compare the record in Cloudflare with the value shown in the Vectis dashboard character by character. The DKIM public key must be complete.

### Aggressive caching on API requests

**Symptom**: API responses are cached or stale when accessed through a proxied hostname.

**Fix**: If you proxy the admin hostname separately, add a Cloudflare Page Rule or Cache Rule to bypass caching for `/api/*` paths. Or simply keep the admin dashboard on the DNS-only mail hostname.

## Recommended Cloudflare settings

| Setting | Recommended value | Why |
|---------|------------------|-----|
| Mail hostname proxy | DNS-only (grey cloud) | Mail protocols cannot pass through Cloudflare proxy |
| Email Routing | Disabled | Conflicts with self-hosted mail |
| DNSSEC | Enabled | Prevents DNS spoofing |
| Universal SSL | Does not apply (DNS-only) | Your mail hostname is not proxied |
| Always Use HTTPS | Does not apply (DNS-only) | Traefik handles HTTPS redirect |

## Next steps

- [DNS setup quickstart](/getting-started/dns-setup) for a condensed record reference
- [TLS certificates](/guides/tls-certificates) for DNS-01 challenge details
- [DKIM, SPF & DMARC](/guides/dkim-spf-dmarc) for authentication deep dive
- [Troubleshooting](/guides/troubleshooting) for diagnosing DNS-related issues
