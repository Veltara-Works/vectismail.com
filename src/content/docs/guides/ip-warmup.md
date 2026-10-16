---
title: "IP Warmup for New Mail Servers"
description: "A complete guide to IP warmup for new mail servers: why it matters, Vectis Mail's 30-day schedule, the warmup API, monitoring progress, and mistakes to avoid."
faq:
  - q: "How long does email IP warmup take?"
    a: "Vectis Mail's built-in warmup runs 30 days, starting at 50 external recipients a day and ramping to 200,000 a day, holding each level for two days to establish a consistent pattern. After day 30 the warmup completes on its own and the limit is removed."
  - q: "What happens if I send too much email from a new IP without warming up?"
    a: "Providers treat a high-volume new IP like a spammer: Gmail defers with 421 'try again later' errors (eventually bouncing them), Microsoft 365 blocks the IP and requires manual delisting, and Yahoo silently routes you to spam. Recovering a damaged reputation takes weeks to months — far longer than warming up correctly the first time."
  - q: "Do I need to warm up my IP if I'm migrating an existing mail server?"
    a: "If the IP already carries an established sending reputation, you can skip or remove warmup. Warmup matters for fresh IPs with no history; for a known-good IP you're moving over, the reputation travels with the address."
  - q: "Can I pause and resume IP warmup?"
    a: "There is no pause. The schedule is designed for 30 consecutive days of sending, and a gap of several days can cost the reputation you've built. Cancelling and starting again begins at day 1, so keep a warmup running once it has started."
  - q: "What if my server moves to a new IP?"
    a: "A Vectis Mail server sends from one IP, so one warmup runs at a time. If the server moves to a fresh IP, cancel the old warmup and start a new one for the new address."
---

When you deploy a new mail server on a fresh IP address, major email providers (Gmail, Outlook, Yahoo) have no history for that IP. They treat unknown IPs with suspicion -- sending too much mail too quickly from an unknown IP triggers rate limiting, deferrals, or outright blocks. IP warmup is the process of gradually increasing your sending volume over 30 days to build a positive reputation.

Vectis Mail has a built-in warmup system that automatically manages daily sending limits and advances the schedule for you. It counts recipients outside your server: mail between mailboxes on your own domains never leaves the server, so it doesn't count.

## Why warmup matters

Email providers use IP reputation as a primary signal for spam filtering. A brand-new IP has a neutral reputation -- it is neither trusted nor distrusted. The provider's algorithms need to observe a pattern of:

- Consistent sending volume
- Low bounce rates
- Low spam complaint rates
- Valid authentication (SPF, DKIM, DMARC)
- Engaged recipients (opens, clicks, replies)

Sending 50,000 emails on day one from a new IP is indistinguishable from a spammer who just provisioned a VPS. Even if every message is legitimate, the IP will be throttled or blocked.

### What happens without warmup

- **Gmail**: Defers messages with 421 errors ("try again later"), eventually bouncing them
- **Microsoft 365**: Blocks the IP after detecting volume spikes, requiring manual delisting
- **Yahoo**: Silently drops messages to the spam folder
- **Corporate mail servers**: Block unknown IPs that exceed their rate limits

Recovery from a damaged reputation takes weeks to months -- far longer than doing the warmup correctly in the first place.

## The Vectis warmup schedule

Vectis uses a 30-day warmup ramp that starts at 50 external recipients per day and increases to 200,000 per day. A message to three outside addresses counts as three. The schedule holds each level for two days to establish a consistent pattern before increasing:

| Days | Daily limit | Cumulative capacity |
|------|-------------|-------------------|
| 1-2 | 50 | 100 |
| 3-4 | 100 | 300 |
| 5-6 | 200 | 700 |
| 7-8 | 500 | 1,700 |
| 9-10 | 1,000 | 3,700 |
| 11-12 | 2,000 | 7,700 |
| 13-14 | 5,000 | 17,700 |
| 15-16 | 10,000 | 37,700 |
| 17-18 | 20,000 | 77,700 |
| 19-20 | 40,000 | 157,700 |
| 21-22 | 60,000 | 277,700 |
| 23-24 | 80,000 | 437,700 |
| 25-26 | 100,000 | 637,700 |
| 27-28 | 150,000 | 937,700 |
| 29-30 | 200,000 | 1,337,700 |

After day 30, the warmup is automatically marked as complete and the limit is removed.

### How the schedule works

Vectis tracks warmup state in Postgres and checks the schedule every five minutes:

1. Each day starts 24 hours after the previous one, at the same time of day
2. At the start of a day, the warmup moves to the next day's limit and today's count goes back to zero
3. After day 30, the warmup completes and stops limiting

If the server was down for a few days, the schedule moves on by one day, not several: the ramp only speeds up on days the server actually sent.

### What happens at the limit

Every message is checked against the day's limit before it is accepted, whichever way it is sent:

- **The send API** answers `429` with error code `WARMUP_LIMIT` and a `Retry-After` header giving the seconds until the limit resets. The message is not accepted, so your application decides when to send it again. In a batch send, the message's result carries `WARMUP_LIMIT`.
- **Mail clients and apps sending over SMTP** (ports 587 and 465) are told `452 4.5.3` at the end of the message: a temporary refusal, so nothing bounces and the client can try again later.

A message is accepted or refused as a whole. If it has more outside recipients than the day allows, split it into smaller sends.

## Starting warmup

### Via the API

```bash
curl -X POST https://mail.example.com/api/v1/deliverability/warmup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ip_address": "203.0.113.10",
    "label": "Primary mail server"
  }'
```

Response:

```json
{
  "data": {
    "id": "01914f3e-7a5c-7000-8000-000000000001",
    "ip_address": "203.0.113.10",
    "label": "Primary mail server",
    "warmup_started": "2026-04-04T00:00:00Z",
    "warmup_day": 1,
    "daily_limit": 50,
    "daily_sent": 0,
    "active": true
  }
}
```

Only one warmup runs at a time. Starting a second one while another is active returns `409 WARMUP_ACTIVE`.

### Via the dashboard

1. Log into the Vectis admin dashboard as a super admin
2. Open **Deliverability** and find the **IP warmup** card
3. Enter the server's sending IP (the **Blocklist status** card above shows it) and an optional label
4. Click **Start warmup**. The warmup begins immediately

## Monitoring warmup progress

### Via the API

```bash
# List all warmup entries with status
curl https://mail.example.com/api/v1/deliverability/warmup \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:

```json
{
  "data": [
    {
      "id": "01914f3e-7a5c-7000-8000-000000000001",
      "ip_address": "203.0.113.10",
      "label": "Primary mail server",
      "warmup_started": "2026-04-04T00:00:00Z",
      "warmup_day": 7,
      "days_total": 30,
      "daily_limit": 500,
      "daily_sent": 342,
      "next_reset_at": "2026-04-11T00:00:00Z",
      "active": true,
      "schedule_limit": 500,
      "utilization_pct": 68.4
    }
  ]
}
```

Key fields to monitor:

| Field | Meaning |
|-------|---------|
| `warmup_day` | Current day in the 30-day schedule |
| `daily_limit` | External recipients allowed today |
| `daily_sent` | External recipients sent so far today |
| `next_reset_at` | When today's count resets and the next day's limit applies |
| `utilization_pct` | Percentage of daily limit used |
| `schedule_limit` | The schedule's limit for the current day |
| `active` | `true` while warmup is in progress, `false` when complete |

### Via the dashboard

The **IP warmup** card on the Deliverability page shows:

- The current day of the 30
- Today's external recipients against the day's limit, flagged when the limit is reached
- When the count resets and the limit rises
- A **Cancel warmup** button

## Best practices during warmup

### Send to engaged recipients first

During the first two weeks, prioritise sending to recipients who are most likely to engage with your email (open, click, reply). Engagement signals are the strongest positive reputation indicators. If you have a mailing list, start with your most active subscribers.

### Maintain low bounce rates

Keep your bounce rate below 2% throughout warmup. If you are migrating from another provider, clean your mailing list before starting:

- Remove addresses that have bounced in the past
- Remove addresses that have not engaged in 6+ months
- Verify addresses with an email validation service if you are unsure

### Spread sends throughout the day

Do not send your entire daily allocation in a single batch at midnight. Spread messages throughout the day to mimic organic sending patterns. If you are using the Vectis API for transactional email, this happens naturally.

### Monitor delivery metrics

During warmup, check daily:

- **Bounce rate**: Should be under 2%
- **Spam complaint rate**: Should be under 0.1%
- **Deferral rate**: Some deferrals are normal during warmup; persistent deferrals from a specific provider indicate a problem
- **Blocklist status**: Check the **Blocklist status** card on the Deliverability page (or `GET /api/v1/deliverability/rbl`) to make sure your IP isn't listed

### Keep sending every day

If you stop sending for several days during warmup, you may lose the reputation you have built. The schedule is designed for 30 consecutive days of steady sending. There is no pause: cancelling and starting again begins at day 1.

## Stopping or removing warmup

### Remove warmup tracking

```bash
curl -X DELETE https://mail.example.com/api/v1/deliverability/warmup/WARMUP_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Removing warmup tracking immediately removes the sending limit. The dashboard's **Cancel warmup** button does the same. Only do this if:

- The 30-day warmup is complete (it auto-deactivates)
- You are migrating an IP that already has an established reputation
- You are testing in a development environment

## When warmup is complete

After day 30, Vectis automatically deactivates the warmup entry for the IP. From this point:

- The daily limit is removed
- The IP is considered fully warmed
- You should continue to follow [deliverability best practices](/guides/deliverability/) to maintain your reputation

Your IP's reputation is not permanent. Even after warmup, sudden volume spikes, high bounce rates, or spam complaints can damage it. Treat warmup as the foundation, not a one-time task.

## Common mistakes

### Sending too much too soon

The most common mistake. Even if you have 10,000 messages queued, the warmup schedule exists for a reason. If you need to send high volumes from day one, consider using an established relay service for the first 30 days while your IP warms up.

### Ignoring bounces during warmup

A 5% bounce rate during warmup will damage your reputation far more than the same rate from an established IP. Clean your lists aggressively before starting.

### Warming up with low-quality traffic

Sending password reset emails to inactive accounts or re-engagement campaigns during warmup is counterproductive. These messages have low engagement and high complaint rates -- exactly the signals that harm your reputation.

### Not setting up authentication first

SPF, DKIM, and DMARC must be fully configured and passing before you start warmup. Sending unauthenticated mail from a new IP is a recipe for immediate blocking. See the [DKIM, SPF & DMARC guide](/guides/dkim-spf-dmarc/).

### Sharing an IP with untrusted senders

If multiple domains share the same IP and one domain sends spam, all domains on that IP suffer. In Vectis, you control all domains on your server, so this is only a concern if you host mail for external parties.

## Moving to a new IP

A Vectis Mail server sends from one IP, and the daily limit applies to all mail leaving it, so one warmup runs at a time. If the server moves to a fresh IP, cancel the old warmup and start a new one for the new address. Each IP builds its own reputation, so the new one starts from day 1.

## Frequently asked questions

### How long does email IP warmup take?

Vectis Mail's built-in warmup runs 30 days, starting at 50 external recipients a day and ramping to 200,000 a day, holding each level for two days to establish a consistent pattern. After day 30 the warmup completes on its own and the limit is removed.

### What happens if I send too much email from a new IP without warming up?

Providers treat a high-volume new IP like a spammer: Gmail defers with 421 "try again later" errors (eventually bouncing them), Microsoft 365 blocks the IP and requires manual delisting, and Yahoo silently routes you to spam. Recovering a damaged reputation takes weeks to months — far longer than warming up correctly the first time.

### Do I need to warm up my IP if I'm migrating an existing mail server?

If the IP already carries an established sending reputation, you can skip or remove warmup. Warmup matters for fresh IPs with no history; for a known-good IP you're moving over, the reputation travels with the address.

### Can I pause and resume IP warmup?

There is no pause. The schedule is designed for 30 consecutive days of sending, and a gap of several days can cost the reputation you've built. Cancelling and starting again begins at day 1, so keep a warmup running once it has started.

### What if my server moves to a new IP?

A Vectis Mail server sends from one IP, so one warmup runs at a time. If the server moves to a fresh IP, cancel the old warmup and start a new one for the new address.

## Next steps

- [DKIM, SPF & DMARC configuration](/guides/dkim-spf-dmarc/) -- set up authentication before warmup
- [Email deliverability best practices](/guides/deliverability/) -- maintain your reputation after warmup
- [DNS setup](/getting-started/dns-setup/) -- ensure PTR, MX, and A records are correct
