---
title: "Email Deliverability Best Practices"
description: "A comprehensive guide to email deliverability for self-hosted mail servers. Covers DNS authentication, IP reputation management, content best practices, bounce handling, FBL processing, RBL monitoring, and using the Vectis deliverability dashboard."
---

Deliverability is the percentage of your emails that reach the inbox rather than the spam folder or a bounce. Running your own mail server gives you full control over your sending reputation, but it also means you are responsible for maintaining it. This guide covers everything you need to know.

## The deliverability stack

Deliverability depends on multiple layers working together:

| Layer | What it covers | Impact |
|-------|---------------|--------|
| **DNS authentication** | SPF, DKIM, DMARC, PTR | Pass/fail gate -- without these, most mail is rejected |
| **IP reputation** | Warmup, volume consistency, RBL status | Determines initial filtering decisions |
| **Domain reputation** | Complaint rates, bounce rates, engagement | Long-term sending health |
| **Content quality** | Subject lines, formatting, links, attachments | Affects spam scoring |
| **Recipient engagement** | Opens, clicks, replies, time-in-inbox | Strongest positive signal for inbox placement |
| **Infrastructure** | TLS, valid certificates, correct headers | Baseline hygiene checks |

## DNS authentication

This is the non-negotiable foundation. Every domain on your Vectis server must have:

### SPF

Declares your server IP as an authorised sender.

```dns
example.com.  IN  TXT  "v=spf1 mx a ip4:203.0.113.10 -all"
```

### DKIM

Cryptographic signature on every outgoing message. Vectis auto-generates DKIM keys when you add a domain. Publish the record from the dashboard.

```dns
202604._domainkey.example.com.  IN  TXT  "v=DKIM1; k=rsa; p=MIIBIjANBg..."
```

### DMARC

Ties SPF and DKIM together with a policy and reporting address.

```dns
_dmarc.example.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; fo=1"
```

### PTR (reverse DNS)

Your server IP must have a PTR record that resolves to your mail hostname. Set this at your VPS provider. Many receiving servers reject mail from IPs without a valid PTR record.

```bash
# Verify your PTR record
dig -x 203.0.113.10 +short
# Should return: mail.example.com.
```

For a detailed walkthrough, see [DKIM, SPF & DMARC configuration](/docs/guides/dkim-spf-dmarc).

### Vectis deliverability checker

Run a complete check from the CLI or API:

```bash
vectis domain check example.com
```

This validates SPF, DKIM, DMARC, PTR, MX records, and TLS configuration in a single command. The dashboard shows persistent green/yellow/red status indicators for each domain.

## IP reputation

### New IPs need warmup

If your server uses a fresh IP address, you must warm it up gradually. Vectis has a built-in 30-day warmup schedule that starts at 50 messages per day and ramps to 200,000. See [IP warmup for new servers](/docs/guides/ip-warmup) for the full guide.

### Volume consistency

Sudden spikes in sending volume trigger spam filters. If you normally send 1,000 emails per day and suddenly send 50,000, receivers will flag the spike as suspicious. Increase volume gradually, even after warmup is complete.

### RBL monitoring

Real-time Blackhole Lists (RBLs) are blocklists of IP addresses that have been reported for sending spam. Being listed on even one major RBL can devastate your deliverability.

Vectis monitors your server IP against major RBLs automatically:

```bash
# Check RBL status via API
curl https://mail.example.com/api/v1/deliverability/rbl \
  -H "Authorization: Bearer YOUR_TOKEN"

# Trigger an immediate check
curl -X POST https://mail.example.com/api/v1/deliverability/rbl/check \
  -H "Authorization: Bearer YOUR_TOKEN"
```

The RBLs checked include:

| RBL | Significance |
|-----|-------------|
| Spamhaus ZEN | Most widely used; listing here blocks delivery to most major providers |
| Barracuda BRBL | Used by many corporate mail servers |
| SpamCop | Complaint-driven; listings usually auto-expire |
| SORBS | Tracks dynamic/residential IPs and open relays |
| CBL | Tracks IPs sending spam from botnets |

If you find yourself listed, the Vectis dashboard provides a link to the delisting page for each RBL.

### Maintaining IP reputation

- Never send unsolicited email
- Process bounces promptly (see below)
- Keep complaint rates below 0.1%
- Monitor RBL status daily (Vectis does this automatically)
- Avoid sharing your IP with untrusted senders

## Bounce handling

Bounces are messages that could not be delivered. There are two types:

### Hard bounces

Permanent failures: the address does not exist, the domain is invalid, or the recipient server permanently rejected the message.

**Action required**: Remove the address immediately. Continuing to send to addresses that hard bounce signals to providers that you do not maintain your lists.

### Soft bounces

Temporary failures: mailbox full, server temporarily unavailable, rate limiting during warmup.

**Action required**: Retry automatically (Postfix handles this). If the same address soft bounces consistently across multiple attempts over several days, treat it as a hard bounce and remove it.

### Vectis bounce processing

Vectis processes bounces automatically:

1. Postfix receives the DSN (Delivery Status Notification) bounce message
2. The bounce is logged and associated with the original outbound message
3. Hard bounces are flagged in the deliverability metrics
4. The dashboard shows bounce rates per domain

Monitor your bounce rate via the API:

```bash
curl https://mail.example.com/api/v1/domains/DOMAIN_ID/deliverability \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Target**: Keep your hard bounce rate below 2%. During warmup, aim for below 1%.

## Feedback loop (FBL) processing

When a recipient marks your message as spam in their email client, the recipient's provider can send a complaint report back to you via a Feedback Loop. Major providers (Gmail via Postmaster Tools, Microsoft via JMRP, Yahoo via CFL) offer FBL programs.

### How FBL works in Vectis

Vectis records FBL complaints and links them to the original message and domain:

```bash
# View recent FBL complaints
curl https://mail.example.com/api/v1/deliverability/fbl \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filter by domain
curl "https://mail.example.com/api/v1/deliverability/fbl?domain_id=DOMAIN_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Each complaint includes:
- The reporter domain (which provider sent the complaint)
- The complaint type
- A link to the original message (if identifiable)
- Timestamp

### Acting on FBL complaints

- **Remove the complainant** from all future mailings immediately
- **Investigate** if you see a spike in complaints -- check message content, list source, and sending patterns
- **Target**: Keep your complaint rate below 0.1% (1 complaint per 1,000 messages)

## Content best practices

Spam filters analyse message content in addition to sender reputation. Follow these guidelines:

### Subject lines

- Avoid ALL CAPS, excessive punctuation (!!!), and spammy phrases ("FREE", "ACT NOW", "Limited time")
- Keep subject lines clear and relevant to the message body
- Personalise where possible

### Message body

- Include a plain text version alongside HTML (Vectis API supports both `text_body` and `html_body`)
- Maintain a reasonable text-to-image ratio -- do not send image-only emails
- Include your physical mailing address in marketing emails (CAN-SPAM, GDPR)
- Always include an unsubscribe link in marketing/bulk emails

### Links and domains

- All links should point to domains you own and control
- Avoid URL shorteners (bit.ly, tinyurl) -- spam filters view them with suspicion
- Make sure linked domains have valid TLS certificates
- Do not use IP addresses as link targets

### Attachments

- Avoid executable attachments (.exe, .bat, .scr) -- they will be blocked
- PDF, image, and document attachments are generally safe
- Large attachments increase spam scores -- use download links instead when possible

## List hygiene

Maintain clean recipient lists:

### Acquisition

- Use confirmed opt-in (double opt-in) for mailing lists
- Never buy, rent, or scrape email lists
- Record when and how each address opted in (consent audit trail)

### Ongoing maintenance

- Remove hard bounces immediately
- Remove addresses that have not engaged in 6+ months
- Process unsubscribe requests within 24 hours
- Regularly validate addresses with an email verification service

### Sunset policy

Establish a sunset policy for inactive subscribers. If a recipient has not opened or clicked any email in 90-180 days, move them to a re-engagement segment. If re-engagement fails, remove them.

## Monitoring deliverability

### Google Postmaster Tools

If you send to Gmail recipients, register your domain at [postmaster.google.com](https://postmaster.google.com). Google provides:

- Domain and IP reputation ratings
- Spam rate (percentage of your mail marked as spam by recipients)
- Authentication results (SPF, DKIM, DMARC pass rates)
- Delivery errors

This is the single most valuable external monitoring tool for deliverability.

### Microsoft SNDS

For Outlook/Hotmail recipients, register at [sendersupport.olc.protection.outlook.com/snds](https://sendersupport.olc.protection.outlook.com/snds) for:

- IP reputation status (green, yellow, red)
- Trap hit rates
- Complaint rates

### Testing tools

| Tool | Purpose | URL |
|------|---------|-----|
| mail-tester.com | Overall deliverability score | mail-tester.com |
| MXToolbox | DNS record validation, blacklist check | mxtoolbox.com |
| Gmail "Show Original" | View authentication results for a specific message | (within Gmail) |
| Vectis domain check | Built-in DNS and authentication validation | `vectis domain check` |

## The deliverability checklist

Use this checklist when setting up a new domain on Vectis:

- [ ] SPF record published with your server IP and `-all`
- [ ] DKIM record published with the key from the Vectis dashboard
- [ ] DMARC record published (start with `p=none`, progress to `p=reject`)
- [ ] PTR record set at your VPS provider, matching your mail hostname
- [ ] MX record pointing to your mail hostname
- [ ] A record for your mail hostname pointing to your server IP
- [ ] TLS certificate valid and not expiring soon
- [ ] IP warmup started (if this is a new IP)
- [ ] `vectis domain check` shows all green
- [ ] Test email received in inbox (not spam) at Gmail, Outlook, and Yahoo
- [ ] Google Postmaster Tools registered
- [ ] RBL status clean

## Next steps

- [DKIM, SPF & DMARC configuration](/docs/guides/dkim-spf-dmarc) for detailed authentication setup
- [IP warmup for new servers](/docs/guides/ip-warmup) for the 30-day warmup guide
- [Cloudflare integration](/docs/guides/cloudflare) for DNS management with Cloudflare
- [Troubleshooting](/docs/guides/troubleshooting) for diagnosing delivery failures
