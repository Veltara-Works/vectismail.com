---
title: DNS Setup
description: Configure MX, A, PTR, SPF, DKIM, and DMARC records for your Vectis Mail server.
---

Proper DNS configuration is essential for email deliverability. This guide covers all the records you need.

## Required Records

For a domain `example.com` on a server at `mail.example.com` (`203.0.113.10`):

### MX Record

Tells other mail servers where to deliver email for your domain.

```dns
example.com.  IN  MX  10  mail.example.com.
```

### A Record

Points your mail hostname to your server's IP.

```dns
mail.example.com.  IN  A  203.0.113.10
```

If you have IPv6:
```dns
mail.example.com.  IN  AAAA  2001:db8::1
```

### PTR Record (Reverse DNS)

Maps your IP back to your hostname. **Critical for deliverability** — many receiving servers reject mail from IPs without matching PTR records.

Set this at your VPS provider (not your DNS provider). The PTR record for `203.0.113.10` should resolve to `mail.example.com`.

### SPF Record

Declares which servers are authorised to send email for your domain.

```dns
example.com.  IN  TXT  "v=spf1 a mx ip4:203.0.113.10 -all"
```

- `a` — allows the domain's A record IP
- `mx` — allows the domain's MX server IPs
- `ip4:203.0.113.10` — explicitly allows your server IP
- `-all` — reject all other senders (use `~all` for soft-fail during testing)

### DKIM Record

Vectis automatically generates a DKIM key pair when you add a domain. The DNS record is shown in the dashboard under **Domains** → **DKIM**.

```dns
default._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSI..."
```

The selector is `default` by default. The full public key is provided by Vectis — copy it exactly.

### DMARC Record

Tells receiving servers what to do with email that fails SPF/DKIM checks.

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100"
```

- `p=quarantine` — failed messages go to spam (use `p=none` during testing, `p=reject` for strict enforcement)
- `rua=mailto:dmarc@example.com` — aggregate reports sent here

## Verification

After adding all records, use the Vectis deliverability checker:

```bash
# Via CLI
vectis domain check example.com

# Via API
curl https://your-hostname/api/v1/domains/DOMAIN_ID/deliverability \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Or check in the dashboard under **Deliverability** — it shows a green/yellow/red status for each DNS record.

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| SPF soft-fail | Missing server IP in SPF record | Add `ip4:YOUR_IP` to the SPF TXT record |
| DKIM fail | Wrong selector or truncated key | Copy the full key from the Vectis dashboard |
| No PTR record | Reverse DNS not set at VPS provider | Set PTR at your hosting provider's control panel |
| DMARC none | Policy too permissive | Change `p=none` to `p=quarantine` after testing |

## Next Steps

- [Detailed DKIM, SPF & DMARC guide](/docs/guides/dkim-spf-dmarc)
- [Deliverability best practices](/docs/guides/deliverability)
- [IP warmup for new servers](/docs/guides/ip-warmup)
