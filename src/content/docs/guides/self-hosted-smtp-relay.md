---
title: "SMTP Relay: Send App and Device Email Through Your Own Server"
description: "What an SMTP relay is, when a hosted relay is the right call, and how to send your app, website and device email through a mail server you run yourself."
lastUpdated: 2026-10-18
faq:
  - q: "What is an SMTP relay?"
    a: "An SMTP relay is a mail server that accepts email from your applications, websites or devices and delivers it onward to the recipients' mail servers. Your app hands the message over with authenticated SMTP (usually port 587 or 465), and the relay handles DNS lookups, retries, signing (DKIM) and delivery. Hosted relays such as SendGrid, Mailgun or Amazon SES do this as a service; you can also run your own."
  - q: "Should I use a hosted SMTP relay or my own mail server?"
    a: "Use a hosted relay if you send high-volume marketing or bulk email, can't open port 25 on your server, or don't want to manage a server at all. Use your own mail server if you already run (or want to run) your own email, mostly send transactional mail such as receipts, password resets and notifications, want a flat cost instead of per-message pricing, or need to keep message data on infrastructure you control."
  - q: "Which port should an app use to send through an SMTP relay?"
    a: "Use port 587 with STARTTLS, or port 465 with implicit TLS, and authenticate with a username and password. Port 25 is for server-to-server delivery; on a properly configured mail server it won't accept authentication or relay mail for clients."
  - q: "Can a printer or scanner send scan-to-email through a self-hosted mail server?"
    a: "Yes, if the device supports SMTP authentication and TLS 1.2 or newer on port 587 or 465. Vectis Mail requires TLS 1.2 as a minimum and doesn't relay unauthenticated mail on port 25, so older devices that only support TLS 1.0 or unauthenticated port 25 need a firmware update or a small local relay in between."
  - q: "Will email sent through my own SMTP relay reach the inbox?"
    a: "It can, and the requirements are the same ones hosted relays meet on your behalf: SPF, DKIM and DMARC records for your domain, a reverse DNS (PTR) record for your server's IP, valid TLS, and a sending IP with a good reputation. A new IP needs warming up, with volume increased gradually over a few weeks, before it can handle larger sends."
  - q: "Is there a free SMTP relay?"
    a: "Most hosted relays have a small free tier with daily or monthly limits and branding or support restrictions, and charge per message beyond it. Running your own mail server has no per-message cost, but you pay for the server (typically a small VPS) and take on its operation, including IP reputation."
---

**Short answer.** An SMTP relay is a mail server that accepts email from your apps, websites and devices and delivers it to recipients. Your app connects on **port 587 (STARTTLS) or 465 (TLS)**, logs in, and hands the message over; the relay does the rest: DNS lookups, DKIM signing, retries and delivery. You can rent one (SendGrid, Mailgun, Amazon SES and others) or **run your own**. A hosted relay is the better choice for high-volume marketing email or if you can't run a server. Your own mail server is the better choice if you already self-host email, mostly send transactional mail, and want a flat cost and control over your data.

## Hosted relay or your own: how to decide

| | Hosted SMTP relay | Your own mail server as the relay |
|---|---|---|
| **Cost** | Free tier, then per message or per plan | Flat: the server (a small VPS), no per-message fees |
| **Setup** | Sign up, add DNS records, get credentials | Install a mail server, add DNS records, create a sending mailbox |
| **Sending IP** | Shared or dedicated IPs the provider manages | Your server's IP: you build and keep its reputation |
| **Best for** | Marketing blasts, very high volume, no server to run | Receipts, password resets, notifications, website forms, internal alerts |
| **Port 25** | Not needed on your side | Must be open outbound on your server |
| **Message data** | Passes through and is logged by the provider | Stays on infrastructure you control |
| **Receiving mail** | Usually not included | Same server handles your mailboxes |

The honest rule: **if bulk or cold marketing email is core to your business, use a provider with a managed IP pool.** Reputation for those sending patterns is fragile, and it's worth paying someone to manage it. For everything else, including the email your product itself sends, your own server is usually simpler and cheaper, especially if you'd be running one for your team's mailboxes anyway.

## How to send through your own server

With [Vectis Mail](/), any mailbox can send authenticated mail, so an app or device just needs a mailbox of its own.

1. **Create a dedicated sending mailbox**, such as `noreply@example.com` or `app@example.com`. Keep it separate from people's mailboxes so you can rotate its password or suspend it without affecting anyone.
2. **Use these settings in your app or device:**

| Setting | Value |
|---|---|
| SMTP host | your mail hostname, e.g. `mail.example.com` |
| Port | `587` (STARTTLS) or `465` (SSL/TLS) |
| Encryption | Required: TLS 1.2 or newer |
| Authentication | Username = the full mailbox address; password = its password |
| From address | The sending mailbox's address |

3. **Send a test** and check the headers at the receiving end: `spf=pass`, `dkim=pass` and `dmarc=pass` mean everything lines up.

For example, from Python:

```python
import smtplib, ssl
from email.message import EmailMessage

msg = EmailMessage()
msg["From"] = "noreply@example.com"
msg["To"] = "customer@example.org"
msg["Subject"] = "Your receipt"
msg.set_content("Thanks for your order.")

with smtplib.SMTP("mail.example.com", 587) as s:
    s.starttls(context=ssl.create_default_context())
    s.login("noreply@example.com", "the-mailbox-password")
    s.send_message(msg)
```

Most frameworks and CMSs (Laravel, Django, Rails, Node's Nodemailer, WordPress SMTP plugins) take the same five settings.

### Or skip SMTP and use the API

If your app can make an HTTPS request, Vectis Mail's [sending API](/api/sending/) is often easier than SMTP: one `POST` per message, API keys that can be limited to specific domains, and [webhooks](/api/webhooks/) for delivery and bounce events. It sends through the same server, with the same DKIM signing and the same reputation.

## What protects you when you run the relay

A relay you run is only as good as its safeguards. These are built into Vectis Mail:

- **No open relay.** Port 25 is for receiving mail from other servers. It doesn't accept logins, and it won't relay mail for anyone who isn't authenticated.
- **TLS required for sending.** Ports 587 and 465 require encryption, with TLS 1.2 as the minimum.
- **Sending limits.** Per-mailbox and per-domain hourly sending rates are tracked, and a mailbox that exceeds its limit is suspended automatically, so a leaked app password can't burn your reputation overnight. Sudden spikes raise an alert.
- **IP warmup.** A new server's IP has no reputation yet. During warmup, sends over the day's allowance are deferred with a temporary `452 4.5.3` reply, which apps and SMTP clients retry later, instead of being sent too fast. See the [IP warmup guide](/guides/ip-warmup/).
- **DKIM signing and DMARC** for every domain, set up when you add the domain. See [DKIM, SPF and DMARC](/guides/dkim-spf-dmarc/).

## Devices: printers, scanners and appliances

Scan-to-email and appliance alerts work through your own server if the device supports **SMTP authentication and TLS 1.2+ on port 587 or 465**. Older devices are the usual problem: some only speak TLS 1.0 or expect to send unauthenticated on port 25. For those, update the firmware if you can. Otherwise put a small relay on your local network that accepts the device's mail and forwards it to your server over an authenticated, encrypted connection.

## Before you switch

- **Open outbound port 25** on your server. Many VPS providers block it by default and lift it on request.
- **Set reverse DNS (PTR)** for your server's IP to match your mail hostname.
- **Publish SPF, DKIM and DMARC** for each sending domain.
- **Warm up** a new IP before moving large volumes onto it.
- **Keep bulk marketing separate.** If you also send newsletters at scale, keep that on a dedicated provider so it can't affect the reputation your transactional mail depends on.

If you're weighing this against a hosted provider, our [SendGrid](/alternatives/sendgrid/) and [Postmark](/alternatives/postmark/) comparisons go into the trade-offs in more detail, and the [deliverability guide](/guides/deliverability/) covers what decides inbox placement for any sender.
