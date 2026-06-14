---
title: "SPF, DKIM & DMARC for Self-Hosted Email"
description: "How SPF, DKIM, and DMARC work together to authenticate self-hosted email — with copy-paste DNS records, the Gmail/Yahoo bulk-sender requirements, and how to verify alignment. Vectis Mail auto-generates DKIM keys and signs every message."
faq:
  - q: "What's the difference between SPF, DKIM, and DMARC?"
    a: "SPF lists which servers may send mail for your domain. DKIM cryptographically signs each message so receivers can verify it was not altered and genuinely came from your domain. DMARC ties the two together: it checks that SPF or DKIM aligns with the visible From address, and tells receivers what to do — and where to send reports — when authentication fails. You need all three for reliable inbox placement."
  - q: "Do I need all three to send email?"
    a: "You should publish all three. Since February 2024, Google and Yahoo require bulk senders (5,000+ messages per day) to pass SPF, DKIM, and DMARC, and mailbox providers increasingly treat a missing DMARC record as a spam signal even at low volume. Vectis Mail signs DKIM automatically; you publish the SPF and DMARC TXT records once."
  - q: "How do I check my SPF, DKIM, and DMARC records?"
    a: "Run `vectis domain check example.com` (or call the deliverability API) for a green/yellow/red status on every record, including PTR and MX. For an outside opinion, send a message to mail-tester.com, or open a test email in Gmail, choose Show original, and look for spf=pass, dkim=pass, and dmarc=pass."
  - q: "I published my DKIM record but it is not working — why?"
    a: "Allow 5–10 minutes for DNS propagation (some providers take up to 48 hours), and confirm the selector in your DNS matches the one Vectis signs with (shown under Domains → DKIM). The other common cause is a truncated public key: long keys may need to be split into multiple quoted strings within the same TXT record."
  - q: "Can I have more than one SPF record?"
    a: "No. A domain must have exactly one SPF TXT record. Two records produce a permanent error (permerror) that most receivers treat as a fail. Merge every sender into a single v=spf1 record, and watch the 10-DNS-lookup limit — Vectis uses a direct ip4: mechanism, which does not count against it."
---

**SPF, DKIM, and DMARC are the three DNS-based standards that prove an email genuinely came from your domain.** SPF authorises which servers may send for you, DKIM cryptographically signs every message, and DMARC ties both to your visible `From` address and tells receivers what to do when a check fails. Self-hosted senders need all three — since [**February 2024, Google and Yahoo require bulk senders (5,000+ messages/day) to authenticate with SPF, DKIM, and DMARC**](https://support.google.com/a/answer/81126), and mailbox providers increasingly treat a missing DMARC record as a spam signal at any volume.

Vectis Mail generates your DKIM key and signs every outgoing message automatically — you publish three TXT records once, then verify alignment. This guide covers what each protocol does, the exact records to publish, and how to confirm everything passes.

:::tip[Already set up?]
Run `vectis domain check example.com` for a green/yellow/red status on SPF, DKIM, DMARC, PTR, and MX in one shot — see [the built-in checker](#vectis-deliverability-checker) below.
:::

## How email authentication works

When a receiving mail server (Gmail, Outlook, Yahoo, etc.) gets a message claiming to be from your domain, it runs three checks:

1. **SPF** -- Is the sending server authorised to send for this domain?
2. **DKIM** -- Was this message cryptographically signed by the domain owner?
3. **DMARC** -- Do SPF and DKIM results align with the From header, and what should we do if they fail?

All three checks happen via DNS lookups against your domain. If any check fails, the receiving server uses your DMARC policy to decide what to do with the message.

## SPF (Sender Policy Framework)

SPF declares which IP addresses are allowed to send email for your domain. It is published as a TXT record on your domain.

### How SPF works

When a server receives mail from `user@example.com`, it looks up the SPF record for `example.com`. If the sending server's IP is listed in that record, SPF passes. If not, SPF fails.

### Recommended SPF record

For a Vectis server at `203.0.113.10`:

```dns
example.com.  IN  TXT  "v=spf1 mx a ip4:203.0.113.10 -all"
```

| Mechanism | Meaning |
|-----------|---------|
| `v=spf1` | This is an SPF record (required prefix) |
| `mx` | Allow any IP that is an MX server for this domain |
| `a` | Allow the IP of the domain's A record |
| `ip4:203.0.113.10` | Explicitly allow this IPv4 address |
| `-all` | Reject all other senders (hard fail) |

If you also have IPv6:

```dns
example.com.  IN  TXT  "v=spf1 mx a ip4:203.0.113.10 ip6:2001:db8::1 -all"
```

### SPF during testing

While you are still setting up, use `~all` (soft fail) instead of `-all` (hard fail). Soft fail tells receiving servers "this might be spam, but don't reject it outright."

```dns
example.com.  IN  TXT  "v=spf1 mx a ip4:203.0.113.10 ~all"
```

Switch to `-all` once you have confirmed everything works.

### Common SPF mistakes

- **Multiple SPF records.** A domain must have exactly one SPF TXT record. If you have two, SPF will return a permanent error (permerror) and most receivers will treat that as a fail.
- **Too many DNS lookups.** SPF has a 10-lookup limit. Each `include:`, `a`, `mx`, and `redirect` counts as one lookup. If you exceed 10, SPF returns permerror. Vectis uses direct IP (`ip4:`) which does not count against this limit.
- **Forgetting the trailing `-all` or `~all`.** Without a mechanism that matches, SPF returns neutral, which many receivers treat as suspicious.

### Verify SPF

```bash
# Using dig
dig TXT example.com +short

# Using nslookup
nslookup -type=TXT example.com

# Using the Vectis CLI
vectis domain check example.com
```

## DKIM (DomainKeys Identified Mail)

DKIM adds a cryptographic signature to every outgoing message. The receiving server verifies this signature against a public key published in your DNS.

### How Vectis handles DKIM

When you add a domain to Vectis, the system automatically:

1. Generates an RSA-2048 key pair
2. Stores the private key at `/var/vectis/dkim/<domain>/<selector>.key` (mode 0600)
3. Configures Rspamd to sign all outgoing mail for that domain
4. Displays the public key DNS record in the dashboard and CLI output

The DKIM selector is date-based by default (e.g., `202604`), making key rotation straightforward.

### Publishing the DKIM record

After adding a domain, Vectis displays the DNS record you need to add:

```dns
202604._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
```

The record name follows the pattern `<selector>._domainkey.<domain>`.

Copy the full value from the Vectis dashboard or CLI output. The public key is a long base64 string -- make sure you copy it completely.

### DKIM key rotation

Vectis supports zero-downtime key rotation:

```bash
# Via CLI
vectis domain dkim-rotate example.com

# Via API
curl -X POST https://mail.example.com/api/v1/domains/DOMAIN_ID/dkim/rotate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This generates a new key pair with a new selector, keeps the old key active for a transition period, and returns the new DNS record to publish. Once the new DNS record has propagated, the old key can be retired.

### Verify DKIM

```bash
# Check that the DNS record exists
dig TXT 202604._domainkey.example.com +short

# Send a test email to Gmail, then view the original message headers
# Look for: dkim=pass header.d=example.com
```

### Common DKIM mistakes

- **Truncated public key.** Some DNS providers have a 255-character limit per TXT record string. If your key is longer, you need to split it across multiple strings within the same TXT record. Most providers handle this automatically, but if yours doesn't, contact their support.
- **Wrong selector.** The selector in your DNS must match the selector Vectis uses for signing. Check the dashboard under Domains > DKIM for the current selector.
- **DNS propagation delay.** After adding the DKIM record, wait 5-10 minutes for propagation before testing. Some providers take up to 48 hours.

## DMARC (Domain-based Message Authentication, Reporting & Conformance)

DMARC ties SPF and DKIM together. It tells receiving servers what to do when authentication fails and where to send reports about authentication results.

### How DMARC works

DMARC checks two things:

1. **SPF alignment** -- Does the domain in the envelope `MAIL FROM` match the domain in the `From` header?
2. **DKIM alignment** -- Does the `d=` domain in the DKIM signature match the domain in the `From` header?

If at least one of these aligns and passes, DMARC passes. If both fail, the receiving server applies your DMARC policy.

### DMARC policy progression

Start permissive and tighten over time:

| Phase | Policy | Duration | Purpose |
|-------|--------|----------|---------|
| **Monitoring** | `p=none` | 2-4 weeks | Collect reports, identify issues |
| **Quarantine** | `p=quarantine` | 2-4 weeks | Failed messages go to spam |
| **Reject** | `p=reject` | Permanent | Failed messages are rejected |

### Recommended DMARC records

**Phase 1 -- Monitoring (start here):**

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@example.com; fo=1"
```

**Phase 2 -- Quarantine:**

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1; pct=100"
```

**Phase 3 -- Reject:**

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=reject; rua=mailto:dmarc@example.com; fo=1; pct=100"
```

| Tag | Meaning |
|-----|---------|
| `v=DMARC1` | DMARC version (required) |
| `p=` | Policy for failed messages: `none`, `quarantine`, or `reject` |
| `rua=` | Where to send aggregate reports (daily XML summaries) |
| `fo=1` | Generate failure reports for any authentication failure |
| `pct=100` | Apply policy to 100% of messages |

### Understanding DMARC alignment

Alignment means the domains used in authentication match the domain in the visible `From` header. There are two alignment modes:

- **Relaxed** (default): The organisational domain must match. `mail.example.com` aligns with `example.com`.
- **Strict**: The exact domain must match. `mail.example.com` does NOT align with `example.com`.

Vectis signs DKIM with the exact domain (e.g., `d=example.com`), so both relaxed and strict alignment will pass for standard configurations.

### DMARC aggregate reports

If you set up a `rua=` address, you will receive daily XML reports from major email providers showing:

- How many messages passed/failed SPF, DKIM, and DMARC
- Which IPs sent mail claiming to be from your domain
- Which authentication methods failed and why

These reports are invaluable for identifying issues and detecting spoofing attempts. Several free services (e.g., DMARC Analyzer, Postmark DMARC) can parse these XML files into readable dashboards.

### Verify DMARC

```bash
# Check the DNS record
dig TXT _dmarc.example.com +short

# Expected output:
# "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1; pct=100"
```

## Putting it all together

Here is a complete DNS record set for `example.com` on a Vectis server at `203.0.113.10`:

```dns
; MX record -- where to deliver mail
example.com.                    IN  MX   10  mail.example.com.

; A record -- mail server IP
mail.example.com.               IN  A        203.0.113.10

; SPF -- who can send for this domain
example.com.                    IN  TXT      "v=spf1 mx a ip4:203.0.113.10 -all"

; DKIM -- public signing key
202604._domainkey.example.com.  IN  TXT      "v=DKIM1; k=rsa; p=MIIBIjANBg..."

; DMARC -- policy and reporting
_dmarc.example.com.             IN  TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1"
```

## Vectis deliverability checker

Vectis has a built-in deliverability checker that verifies all your DNS records:

```bash
# CLI
vectis domain check example.com

# API
curl https://mail.example.com/api/v1/domains/DOMAIN_ID/deliverability \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The checker validates:
- SPF record exists and includes your server IP
- DKIM record exists and matches the active selector
- DMARC record exists with a valid policy
- PTR (reverse DNS) matches your mail hostname
- MX record points to your server

The dashboard shows a green/yellow/red status for each check.

## Testing with external tools

After configuring everything, send a test email and verify the headers:

1. **Gmail**: Open the message, click the three dots, "Show original". Look for `spf=pass`, `dkim=pass`, `dmarc=pass`.
2. **mail-tester.com**: Send an email to the address they provide. Scores 9/10 or above are good.
3. **MXToolbox**: Run SPF, DKIM, and DMARC lookups at mxtoolbox.com/SuperTool.aspx.

## Frequently asked questions

### What's the difference between SPF, DKIM, and DMARC?

SPF lists which servers may send mail for your domain. DKIM cryptographically signs each message so receivers can verify it was not altered and genuinely came from your domain. DMARC ties the two together: it checks that SPF or DKIM aligns with the visible `From` address, and tells receivers what to do — and where to send reports — when authentication fails. You need all three for reliable inbox placement.

### Do I need all three to send email?

You should publish all three. Since February 2024, Google and Yahoo require bulk senders (5,000+ messages per day) to pass SPF, DKIM, and DMARC, and mailbox providers increasingly treat a missing DMARC record as a spam signal even at low volume. Vectis Mail signs DKIM automatically; you publish the SPF and DMARC TXT records once.

### How do I check my SPF, DKIM, and DMARC records?

Run `vectis domain check example.com` (or call the deliverability API) for a green/yellow/red status on every record, including PTR and MX. For an outside opinion, send a message to mail-tester.com, or open a test email in Gmail, choose **Show original**, and look for `spf=pass`, `dkim=pass`, and `dmarc=pass`.

### I published my DKIM record but it isn't working — why?

Allow 5–10 minutes for DNS propagation (some providers take up to 48 hours), and confirm the selector in your DNS matches the one Vectis signs with (shown under **Domains → DKIM**). The other common cause is a truncated public key: long keys may need to be split into multiple quoted strings within the same TXT record.

### Can I have more than one SPF record?

No. A domain must have exactly one SPF TXT record. Two records produce a permanent error (permerror) that most receivers treat as a fail. Merge every sender into a single `v=spf1` record, and watch the 10-DNS-lookup limit — Vectis uses a direct `ip4:` mechanism, which doesn't count against it.

## Next steps

- [Email deliverability best practices](/guides/deliverability) for a comprehensive guide to inbox placement
- [IP warmup for new servers](/guides/ip-warmup) if this is a fresh IP address
- [Cloudflare integration](/guides/cloudflare) for managing DNS records in Cloudflare
- [DNS setup quickstart](/getting-started/dns-setup) for a condensed record reference
