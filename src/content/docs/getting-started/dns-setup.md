---
title: DNS Setup
description: "Configure the MX, A, PTR, SPF, DKIM, and DMARC DNS records your Vectis Mail server needs for reliable delivery and inbox placement, with copy-paste examples."
howToName: Configure DNS records for a Vectis Mail server
howToSteps:
  - name: MX record
    url: "#mx-record"
    text: Publish an MX record at your domain registrar pointing your mail domain at the mail server hostname (e.g. mail.example.com) with priority 10.
  - name: A record
    url: "#a-record"
    text: Publish an A record at your domain registrar pointing the mail server hostname at your VPS's public IPv4 address.
  - name: PTR record (reverse DNS)
    url: "#ptr-record-reverse-dns"
    text: Set the PTR record at your VPS provider's control panel (not your registrar) so your IP resolves back to the mail server hostname.
  - name: SPF record
    url: "#spf-record"
    text: Publish a TXT SPF record authorising your mail server's IP to send email for the domain.
  - name: DKIM record
    url: "#dkim-record"
    text: Publish a TXT DKIM record using the public key the Vectis Mail admin UI prints when you add the domain.
  - name: DMARC record
    url: "#dmarc-record"
    text: Publish a TXT DMARC record with your enforcement policy and a reporting address.
---

Proper DNS configuration is essential for email deliverability. This guide covers all the records you need.

> **Tip:** You usually don't have to construct these by hand. When you add a domain in the [Setup Wizard](/getting-started/first-domain/#step-2--publish-dns-records), Vectis generates every record below pre-filled for your domain, with a **Copy Value** button on each:
>
> ![Setup Wizard step 2 — DNS records with Copy Value buttons for MX, SPF, DKIM, DMARC, and Verification TXT](/screenshots/installation/03-wizard-step2-dns-records.png)
>
> The rest of this page explains what each record does and what the values mean — useful if you're publishing records manually or debugging deliverability.

## Required Records

For a domain `example.com` on a server at `mail.example.com` (`203.0.113.10`), publish these in order:

1. **[MX record](#mx-record)** — points your domain at the mail server hostname.
2. **[A record](#a-record)** — points the mail server hostname at your VPS's IPv4.
3. **[PTR record (reverse DNS)](#ptr-record-reverse-dns)** — set at your VPS provider, **not** your registrar.
4. **[SPF record](#spf-record)** — authorises your mail server's IP to send for the domain.
5. **[DKIM record](#dkim-record)** — published from the public key the admin UI prints when you add the domain.
6. **[DMARC record](#dmarc-record)** — policy + reporting address.

After publishing all records, [verify them](#verification) and address any issues from [common pitfalls](#common-issues).

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

- [Detailed DKIM, SPF & DMARC guide](/guides/dkim-spf-dmarc/)
- [Deliverability best practices](/guides/deliverability/)
- [IP warmup for new servers](/guides/ip-warmup/)
