---
title: "Cloudflare Integration"
description: "How to use Cloudflare DNS with Vectis Mail. Covers MX and mail hostname records (DNS-only mode), SPF/DKIM/DMARC TXT records, how automatic HTTP-01 TLS issuance works behind Cloudflare, and common Cloudflare configuration mistakes."
faq:
  - q: "Can I run a self-hosted mail server behind Cloudflare?"
    a: "Yes for your website and the admin/API over HTTPS, but the mail records themselves must be DNS-only (grey cloud), never proxied (orange cloud). SMTP, IMAP, and POP3 aren't HTTP and can't pass through Cloudflare's proxy, so proxying the mail hostname breaks delivery."
  - q: "Why does my email stop working when I enable the Cloudflare proxy?"
    a: "The orange cloud routes connections to Cloudflare's IPs instead of your server, and mail protocols can't traverse it. The fix is to toggle the mail hostname's A/AAAA record to grey (DNS-only) and wait about 5 minutes for propagation."
  - q: "Should I enable Cloudflare Email Routing with Vectis Mail?"
    a: "No. Email Routing adds its own MX records (route1.mx.cloudflare.net) that conflict with yours and intercept inbound mail before it reaches your server. Disable it under the Email tab and publish your own MX record."
  - q: "How do I tell whether a Cloudflare DNS record is proxied?"
    a: "Run `dig A mail.example.com +short`. A DNS-only record returns your server's real IP (e.g. 203.0.113.10); a proxied record returns a Cloudflare IP in the 104.x.x.x or 172.x.x.x range, which means it needs switching to grey cloud."
  - q: "Do I set the PTR (reverse DNS) record in Cloudflare?"
    a: "No. PTR records are configured at your VPS provider's control panel, not in Cloudflare — your VPS provider controls reverse DNS for your IP. Verify it with `dig -x <your-ip> +short`."
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

## TLS certificates with Cloudflare DNS

Vectis issues its Let's Encrypt certificate automatically using the **HTTP-01** challenge (Traefik on port 80), so built-in issuance does not use Cloudflare's API. For this to work, make sure your mail hostname's A record is set to **DNS only** (grey cloud) — see below — and that port 80 is reachable.

If you can't open port 80, or you want a **wildcard certificate**, obtain one yourself with a DNS-01 challenge (for example using your own [acme.sh](https://github.com/acmesh-official/acme.sh) or certbot with their Cloudflare DNS plugin and a scoped **Zone > DNS > Edit** API token), then point Vectis at it with `provider: custom` in `config.yaml`. With a custom certificate you own renewal. See [TLS certificates](/guides/tls-certificates/) for the full custom-certificate setup.

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

## Frequently asked questions

### Can I run a self-hosted mail server behind Cloudflare?

Yes for your website and the admin/API over HTTPS, but the mail records themselves must be DNS-only (grey cloud), never proxied (orange cloud). SMTP, IMAP, and POP3 aren't HTTP and can't pass through Cloudflare's proxy, so proxying the mail hostname breaks delivery.

### Why does my email stop working when I enable the Cloudflare proxy?

The orange cloud routes connections to Cloudflare's IPs instead of your server, and mail protocols can't traverse it. The fix is to toggle the mail hostname's A/AAAA record to grey (DNS-only) and wait about 5 minutes for propagation.

### Should I enable Cloudflare Email Routing with Vectis Mail?

No. Email Routing adds its own MX records (`route1.mx.cloudflare.net`) that conflict with yours and intercept inbound mail before it reaches your server. Disable it under the **Email** tab and publish your own MX record.

### How do I tell whether a Cloudflare DNS record is proxied?

Run `dig A mail.example.com +short`. A DNS-only record returns your server's real IP (e.g. `203.0.113.10`); a proxied record returns a Cloudflare IP in the `104.x.x.x` or `172.x.x.x` range, which means it needs switching to grey cloud.

### Do I set the PTR (reverse DNS) record in Cloudflare?

No. PTR records are configured at your VPS provider's control panel, not in Cloudflare — your VPS provider controls reverse DNS for your IP. Verify it with `dig -x <your-ip> +short`.

## Next steps

- [DNS setup quickstart](/getting-started/dns-setup/) for a condensed record reference
- [TLS certificates](/guides/tls-certificates/) for automatic HTTP-01 issuance and custom (wildcard / DNS-01) certificates
- [DKIM, SPF & DMARC](/guides/dkim-spf-dmarc/) for authentication deep dive
- [Troubleshooting](/guides/troubleshooting/) for diagnosing DNS-related issues
