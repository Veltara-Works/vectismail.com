---
title: "SPF, DKIM & DMARC: The Complete Email Authentication Guide (2026)"
description: "SPF, DKIM, and DMARC explained — how the three email-authentication standards work together, copy-paste DNS records, recommended TTLs, the Gmail/Yahoo bulk-sender rules, and how to check every record passes."
lastUpdated: 2026-06-21
faq:
  - q: "What's the difference between SPF, DKIM, and DMARC?"
    a: "SPF lists which servers may send mail for your domain. DKIM cryptographically signs each message so receivers can verify it was not altered and genuinely came from your domain. DMARC ties the two together: it checks that SPF or DKIM aligns with the visible From address, and tells receivers what to do — and where to send reports — when authentication fails. You need all three for reliable inbox placement."
  - q: "Do I need all three to send email?"
    a: "You should publish all three. Since February 2024, Google and Yahoo require bulk senders (5,000+ messages per day) to pass SPF, DKIM, and DMARC, and mailbox providers increasingly treat a missing DMARC record as a spam signal even at low volume. Vectis Mail signs DKIM automatically; you publish the SPF and DMARC TXT records once."
  - q: "How do I check my SPF, DKIM, and DMARC records?"
    a: "Run `vectis domain check example.com` (or call the deliverability API) for a green/yellow/red status on every record, including PTR and MX. For an outside opinion, send a message to mail-tester.com, or open a test email in Gmail, choose Show original, and look for spf=pass, dkim=pass, and dmarc=pass."
  - q: "What TTL should SPF, DKIM, and DMARC records use?"
    a: "Use 3600 seconds (one hour) for steady-state records — it keeps DNS load low while letting changes propagate within an hour. Drop the TTL to 300 seconds (five minutes) before you change a record or rotate a DKIM key, then raise it back once the change has settled. TTL never affects whether authentication passes; it only controls how quickly an edit takes effect."
  - q: "I published my DKIM record but it is not working — why?"
    a: "Allow 5–10 minutes for DNS propagation (some providers take up to 48 hours), and confirm the selector in your DNS matches the one Vectis signs with (shown under Domains → DKIM). The other common cause is a truncated public key: long keys may need to be split into multiple quoted strings within the same TXT record."
  - q: "Can I have more than one SPF record?"
    a: "No. A domain must have exactly one SPF TXT record. Two records produce a permanent error (permerror) that most receivers treat as a fail. Merge every sender into a single v=spf1 record, and watch the 10-DNS-lookup limit — Vectis uses a direct ip4: mechanism, which does not count against it."
  - q: "What is DMARC alignment, and what is the difference between relaxed and strict?"
    a: "Alignment means the domain used by SPF or DKIM matches the domain in the visible From header. Relaxed alignment (the default) accepts the organisational domain, so mail.example.com aligns with example.com. Strict alignment requires an exact match. DMARC passes when at least one of SPF or DKIM both passes and aligns. Vectis signs DKIM with the exact domain, so both modes pass for a standard setup."
  - q: "How long before I move DMARC to p=reject?"
    a: "Spend 2–4 weeks at p=none reading the aggregate (rua) reports until every legitimate source authenticates cleanly, then 2–4 weeks at p=quarantine, then move to p=reject. Rushing to reject before your reports are clean can silently drop real mail, so let the data tell you when each source is ready."
  - q: "What is a DKIM selector?"
    a: "A selector is a short label that picks which DKIM public key a receiver should look up — it lets one domain publish several keys at once (for rotation, or for different sending systems). The receiver reads the selector from the `s=` tag in the message's DKIM-Signature header, then queries `<selector>._domainkey.<domain>` for the matching key. Vectis Mail uses a date-based selector like `202606` and rotates it for you, so a new key never collides with the old one."
  - q: "What does p=quarantine vs p=reject mean?"
    a: "They're the two enforcement levels of a DMARC policy. `p=quarantine` tells receivers to treat failing mail as suspicious — usually dropping it into the spam/junk folder, where it's still recoverable. `p=reject` tells them to refuse it outright at SMTP time, so it never reaches the mailbox. Start at `p=none` (monitor only), move to `p=quarantine` once your reports are clean, then to `p=reject` for full protection against spoofing."
  - q: "Why are my emails still going to spam with SPF, DKIM and DMARC set up?"
    a: "Authentication proves who sent the mail; it doesn't guarantee placement. The usual remaining causes are a missing or mismatched PTR (reverse DNS) record, a cold IP with no sending history, blocklist hits, or spammy content and link patterns. Fix PTR first (`dig -x <your-ip>` must return your mail hostname), warm a new IP gradually, and check your domain and IP against the major blocklists. See the deliverability and IP-warmup guides linked below."
  - q: "Which DKIM key type should I use — RSA-2048 or ed25519?"
    a: "Use RSA-2048 as your baseline — every receiver supports it and 1024-bit keys are now considered weak. ed25519 keys are shorter and faster but not yet universally supported, so the modern best practice is to publish both and let receivers verify whichever they understand. Vectis Mail generates ed25519 and RSA keys and signs with both automatically, so there's nothing to configure."
  - q: "Do I need BIMI?"
    a: "BIMI is optional. It displays your brand logo next to authenticated mail in supporting clients, but it requires DMARC at p=quarantine or p=reject first, and most issuers also require a Verified Mark Certificate. Get SPF, DKIM, and DMARC to enforcement first; treat BIMI as a later brand-polish step, not an authentication requirement."
---

**SPF, DKIM, and DMARC are the three DNS-based standards that prove an email genuinely came from your domain.** SPF authorises which servers may send for you, DKIM cryptographically signs every message, and DMARC ties both to your visible `From` address and tells receivers what to do when a check fails. Every sender needs all three — since [**February 2024, Google and Yahoo require bulk senders (5,000+ messages/day) to authenticate with SPF, DKIM, and DMARC**](https://support.google.com/a/answer/81126), and mailbox providers increasingly treat a missing DMARC record as a spam signal at any volume.

This is the complete reference: what each protocol does, the exact records to publish, the TTLs to set, how to verify everything passes, and the standards worth adding once the big three are enforced. Vectis Mail generates your DKIM key and signs every outgoing message automatically — you publish three TXT records once, then verify alignment.

:::tip[Already set up?]
Run `vectis domain check example.com` for a green/yellow/red status on SPF, DKIM, DMARC, PTR, and MX in one shot — see [the built-in checker](#how-to-check-spf-dkim--dmarc) below.
:::

## SPF, DKIM & DMARC at a glance

The three protocols answer three different questions. They are complementary, not alternatives — each closes a gap the others leave open.

| | **SPF** | **DKIM** | **DMARC** |
|---|---|---|---|
| **Question it answers** | Is this server allowed to send for the domain? | Was this message signed by the domain and left unaltered? | Do SPF/DKIM align with the `From` address — and what happens on failure? |
| **DNS record** | One TXT on the domain | TXT at `<selector>._domainkey` | TXT at `_dmarc` |
| **How it works** | IP authorisation list | Public-key signature | Policy + alignment + reporting |
| **What it can't do alone** | Survives forwarding poorly; says nothing about content | Doesn't say which servers are allowed | Nothing — it relies on SPF and DKIM results |
| **If it fails** | Message may be rejected or marked | Signature is ignored for that message | Your policy applies: `none`, `quarantine`, or `reject` |

The short version: **publish all three, get them passing, then tighten DMARC to enforcement.** The rest of this guide is how.

## How email authentication works

When a receiving mail server (Gmail, Outlook, Yahoo, etc.) gets a message claiming to be from your domain, it runs three checks:

1. **SPF** — Is the sending server authorised to send for this domain?
2. **DKIM** — Was this message cryptographically signed by the domain owner?
3. **DMARC** — Do SPF and DKIM results align with the From header, and what should we do if they fail?

All three checks happen via DNS lookups against your domain. If authentication fails, the receiving server uses your DMARC policy to decide what to do with the message.

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

1. Generates DKIM key pairs (RSA-2048 plus ed25519)
2. Stores the private keys at `/var/vectis/dkim/<domain>/<selector>.key` (mode 0600)
3. Configures Rspamd to sign all outgoing mail for that domain
4. Displays the public-key DNS record(s) in the dashboard and CLI output

The DKIM selector is date-based by default (e.g., `202606`), making key rotation straightforward. You publish the records once; signing, the private key, and rotation are handled for you.

### Publishing the DKIM record

After adding a domain, Vectis displays the DNS record you need to add:

```dns
202604._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
```

The record name follows the pattern `<selector>._domainkey.<domain>`.

Copy the full value from the Vectis dashboard or CLI output. The public key is a long base64 string — make sure you copy it completely.

### DKIM key rotation

Vectis supports zero-downtime key rotation:

```bash
# Via CLI
vectis domain dkim-rotate example.com

# Via API
curl -X POST https://mail.example.com/api/v1/domains/DOMAIN_ID/dkim/rotate \
  -H "Authorization: Bearer YOUR_TOKEN"
```

This generates a new key pair with a new selector, keeps the old key active for a transition period, and returns the new DNS record to publish. Once the new DNS record has propagated, the old key can be retired. Lower the DKIM record's TTL to 300 seconds a day before you rotate, so the new selector propagates quickly.

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

1. **SPF alignment** — Does the domain in the envelope `MAIL FROM` match the domain in the `From` header?
2. **DKIM alignment** — Does the `d=` domain in the DKIM signature match the domain in the `From` header?

If at least one of these aligns and passes, DMARC passes. If both fail, the receiving server applies your DMARC policy.

### DMARC policy progression

Start permissive and tighten over time:

| Phase | Policy | Duration | Purpose |
|-------|--------|----------|---------|
| **Monitoring** | `p=none` | 2-4 weeks | Collect reports, identify issues |
| **Quarantine** | `p=quarantine` | 2-4 weeks | Failed messages go to spam |
| **Reject** | `p=reject` | Permanent | Failed messages are rejected |

Do not skip the monitoring phase. `p=none` is the only safe way to discover every legitimate source sending as your domain before you start blocking. Move forward only when the reports show your real mail authenticating cleanly.

### Recommended DMARC records

**Phase 1 — Monitoring (start here):**

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=none; rua=mailto:dmarc@example.com; fo=1"
```

**Phase 2 — Quarantine:**

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1; pct=100"
```

**Phase 3 — Reject:**

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

These reports are invaluable for identifying issues and detecting spoofing attempts. The raw XML is verbose, so most people feed it into a report parser to turn it into a readable dashboard — there are several free and open-source options, or you can point `rua=` at a mailbox on your own Vectis server and review the summaries directly.

## Record TTL: what values to use

The TTL (time to live) on each TXT record controls how long resolvers cache it. **TTL never affects whether authentication passes — only how quickly an edit takes effect.** Set sensible values and you avoid both stale records and needless DNS chatter.

| Situation | Recommended TTL | Why |
|-----------|-----------------|-----|
| Steady state (SPF, DKIM, DMARC) | `3600` (1 hour) | Edits land within an hour; cache load stays low |
| Before editing a record or rotating a DKIM key | `300` (5 min) | New value propagates almost immediately |
| Very stable, rarely-changed record | `86400` (24 hours) | Minimal DNS load; fine if you won't touch it |

The practical rule: lower the TTL to `300` a day before any planned change (a DKIM rotation, an SPF edit, tightening DMARC), make the change, confirm it has propagated, then raise the TTL back to `3600`. The frequently searched "DKIM TTL" question has the same answer as the others — there is nothing DKIM-specific about it beyond rotation timing.

## How to check SPF, DKIM & DMARC

Never assume a record is live just because you saved it. Verify from three angles: the raw DNS, a real delivered message, and an independent scoring tool.

### 1. Check the raw DNS records

```bash
# SPF
dig TXT example.com +short

# DKIM (substitute your selector)
dig TXT 202604._domainkey.example.com +short

# DMARC
dig TXT _dmarc.example.com +short
```

### 2. Use the Vectis deliverability checker

Vectis has a built-in checker that validates every record at once:

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

### 3. Read a real message and score it externally

1. **Gmail**: Open a message you sent, click the three dots, choose **Show original**. Look for `spf=pass`, `dkim=pass`, and `dmarc=pass`.
2. **mail-tester.com**: Send an email to the address they provide. Scores of 9/10 or above are good.
3. **MXToolbox**: Run SPF, DKIM, and DMARC lookups at [mxtoolbox.com/SuperTool.aspx](https://mxtoolbox.com/SuperTool.aspx).

## Putting it all together

Here is a complete DNS record set for `example.com` on a Vectis server at `203.0.113.10`:

```dns
; MX record — where to deliver mail
example.com.                    IN  MX   10  mail.example.com.

; A record — mail server IP
mail.example.com.               IN  A        203.0.113.10

; SPF — who can send for this domain
example.com.                    IN  TXT      "v=spf1 mx a ip4:203.0.113.10 -all"

; DKIM — public signing key
202604._domainkey.example.com.  IN  TXT      "v=DKIM1; k=rsa; p=MIIBIjANBg..."

; DMARC — policy and reporting
_dmarc.example.com.             IN  TXT      "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1"
```

## Beyond the big three: BIMI, MTA-STS, TLS-RPT & ARC

Once SPF, DKIM, and DMARC are passing and DMARC is at enforcement, a handful of newer standards build on top of them. None are required to send authenticated mail — treat them as the next layer, not a prerequisite.

- **BIMI (Brand Indicators for Message Identification)** — displays your brand logo beside authenticated mail in supporting clients. It requires DMARC at `p=quarantine` or `p=reject` first, an SVG Tiny PS logo published in DNS, and (for Gmail and Apple Mail) a Verified Mark Certificate. Pure brand polish; do it last.
- **MTA-STS (SMTP MTS Strict Transport Security)** — tells sending servers to require TLS when delivering to you, closing the door on downgrade attacks. It needs a policy file served over HTTPS at `mta-sts.<domain>` plus a `_mta-sts` TXT record.
- **TLS-RPT** — a TXT record at `_smtp._tls.<domain>` that asks receivers to report TLS delivery failures, so you learn when encrypted delivery breaks. It pairs naturally with MTA-STS.
- **ARC (Authenticated Received Chain)** — preserves authentication results across forwarders and mailing lists, which can otherwise break SPF and DKIM. Mostly relevant if your mail is frequently forwarded.

The right order is always the same: **get SPF, DKIM, and DMARC passing and enforced first.** These extras only matter once that foundation is solid.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `dkim=fail` or `dkim=none` | Selector mismatch, key not propagated, or truncated value | Confirm the DNS selector matches the one Vectis signs with; wait for propagation; check the public key wasn't cut off |
| `spf=permerror` | Two SPF records, or more than 10 DNS lookups | Merge into one record; replace `include:` chains with a direct `ip4:` |
| `spf=softfail` unexpectedly | Sending IP isn't listed | Add the server's `ip4:` (or `mx`/`a`) to the record |
| `dmarc=fail` despite SPF and DKIM passing | Alignment mismatch — strict mode, or `d=` domain differs from `From` | Use relaxed alignment and sign with the organisational domain |
| No DMARC reports arriving | `rua` mailbox missing or mistyped | Confirm the `rua` address exists and can receive mail |
| Mail to Gmail still lands in spam | Missing PTR or low IP reputation | Set reverse DNS to your mail hostname; see [IP warmup](/guides/ip-warmup/) |

## Frequently asked questions

### What's the difference between SPF, DKIM, and DMARC?

SPF lists which servers may send mail for your domain. DKIM cryptographically signs each message so receivers can verify it was not altered and genuinely came from your domain. DMARC ties the two together: it checks that SPF or DKIM aligns with the visible `From` address, and tells receivers what to do — and where to send reports — when authentication fails. You need all three for reliable inbox placement.

### Do I need all three to send email?

You should publish all three. Since February 2024, Google and Yahoo require bulk senders (5,000+ messages per day) to pass SPF, DKIM, and DMARC, and mailbox providers increasingly treat a missing DMARC record as a spam signal even at low volume. Vectis Mail signs DKIM automatically; you publish the SPF and DMARC TXT records once.

### How do I check my SPF, DKIM, and DMARC records?

Run `vectis domain check example.com` (or call the deliverability API) for a green/yellow/red status on every record, including PTR and MX. For an outside opinion, send a message to mail-tester.com, or open a test email in Gmail, choose **Show original**, and look for `spf=pass`, `dkim=pass`, and `dmarc=pass`.

### What TTL should SPF, DKIM, and DMARC records use?

Use 3600 seconds (one hour) for steady-state records — it keeps DNS load low while letting changes propagate within an hour. Drop the TTL to 300 seconds (five minutes) before you change a record or rotate a DKIM key, then raise it back once the change has settled. TTL never affects whether authentication passes; it only controls how quickly an edit takes effect.

### I published my DKIM record but it isn't working — why?

Allow 5–10 minutes for DNS propagation (some providers take up to 48 hours), and confirm the selector in your DNS matches the one Vectis signs with (shown under **Domains → DKIM**). The other common cause is a truncated public key: long keys may need to be split into multiple quoted strings within the same TXT record.

### Can I have more than one SPF record?

No. A domain must have exactly one SPF TXT record. Two records produce a permanent error (permerror) that most receivers treat as a fail. Merge every sender into a single `v=spf1` record, and watch the 10-DNS-lookup limit — Vectis uses a direct `ip4:` mechanism, which doesn't count against it.

### What is DMARC alignment, and what is the difference between relaxed and strict?

Alignment means the domain used by SPF or DKIM matches the domain in the visible `From` header. Relaxed alignment (the default) accepts the organisational domain, so `mail.example.com` aligns with `example.com`. Strict alignment requires an exact match. DMARC passes when at least one of SPF or DKIM both passes and aligns. Vectis signs DKIM with the exact domain, so both modes pass for a standard setup.

### How long before I move DMARC to p=reject?

Spend 2–4 weeks at `p=none` reading the aggregate (`rua`) reports until every legitimate source authenticates cleanly, then 2–4 weeks at `p=quarantine`, then move to `p=reject`. Rushing to reject before your reports are clean can silently drop real mail, so let the data tell you when each source is ready.

### What is a DKIM selector?

A selector is a short label that picks which DKIM public key a receiver should look up — it lets one domain publish several keys at once (for rotation, or for different sending systems). The receiver reads the selector from the `s=` tag in the message's `DKIM-Signature` header, then queries `<selector>._domainkey.<domain>` for the matching key. Vectis Mail uses a date-based selector like `202606` and rotates it for you, so a new key never collides with the old one.

### What does p=quarantine vs p=reject mean?

They are the two enforcement levels of a DMARC policy. `p=quarantine` tells receivers to treat failing mail as suspicious — usually dropping it into the spam/junk folder, where it's still recoverable. `p=reject` tells them to refuse it outright at SMTP time, so it never reaches the mailbox. Start at `p=none` (monitor only), move to `p=quarantine` once your reports are clean, then to `p=reject` for full protection against spoofing.

### Why are my emails still going to spam with SPF, DKIM and DMARC set up?

Authentication proves *who* sent the mail; it doesn't guarantee placement. The usual remaining causes are a missing or mismatched PTR (reverse DNS) record, a cold IP with no sending history, blocklist hits, or spammy content and link patterns. Fix PTR first (`dig -x <your-ip>` must return your mail hostname), warm a new IP gradually, and check your domain and IP against the major blocklists. See [deliverability best practices](/guides/deliverability/) and [IP warmup](/guides/ip-warmup/).

### Which DKIM key type should I use — RSA-2048 or ed25519?

Use RSA-2048 as your baseline — every receiver supports it, and 1024-bit keys are now considered weak. ed25519 keys are shorter and faster but not yet universally supported, so the modern best practice is to publish both and let receivers verify whichever they understand. Vectis generates ed25519 and RSA keys and signs with both automatically, so there is nothing to configure.

### Do I need BIMI?

BIMI is optional. It displays your brand logo next to authenticated mail in supporting clients, but it requires DMARC at `p=quarantine` or `p=reject` first, and most issuers also require a Verified Mark Certificate. Get SPF, DKIM, and DMARC to enforcement first; treat BIMI as a later brand-polish step, not an authentication requirement.

## Next steps

- [Email deliverability best practices](/guides/deliverability/) for a comprehensive guide to inbox placement
- [IP warmup for new servers](/guides/ip-warmup/) if this is a fresh IP address
- [Cloudflare integration](/guides/cloudflare/) for managing DNS records in Cloudflare
- [DNS setup quickstart](/getting-started/dns-setup/) for a condensed record reference
- [The best self-hosted email servers in 2026](/guides/best-self-hosted-email-servers-2026/) if you're still choosing a platform

### Skip the manual setup

Vectis Mail generates your DKIM keys, signs every outgoing message, and shows you the exact SPF, DKIM, and DMARC records to publish — so authentication is right the first time, not after three rounds of failed tests. [Install Vectis Mail on a fresh VPS](/getting-started/installation/) in about 30 minutes, or see [pricing](/pricing/) for the Free Starter and Pro tiers.
