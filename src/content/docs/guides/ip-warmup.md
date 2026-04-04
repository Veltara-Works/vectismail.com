---
title: "IP Warmup for New Mail Servers"
description: "A complete guide to IP warmup for new mail servers. Learn why warmup matters, follow Vectis Mail's 30-day warmup schedule, use the warmup API, monitor progress, and avoid common mistakes that damage sender reputation."
---

When you deploy a new mail server on a fresh IP address, major email providers (Gmail, Outlook, Yahoo) have no history for that IP. They treat unknown IPs with suspicion -- sending too much mail too quickly from an unknown IP triggers rate limiting, deferrals, or outright blocks. IP warmup is the process of gradually increasing your sending volume over 30 days to build a positive reputation.

Vectis Mail has a built-in warmup system that automatically manages daily sending limits and advances the schedule for you.

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

Vectis uses a 30-day warmup ramp that starts at 50 messages per day and increases to 200,000 per day. The schedule holds each level for two days to establish a consistent pattern before increasing:

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

After day 30, the warmup is automatically marked as complete and sending limits are removed.

### How the schedule works internally

Vectis tracks warmup state in Postgres. The warmup manager runs a check every hour:

1. For each active warmup IP, check if 24 hours have elapsed since the last daily reset
2. If yes, advance to the next warmup day, update the daily limit, and reset the sent counter to zero
3. If the IP has completed day 30, mark the warmup as inactive (complete)

Every outbound message is checked against the warmup limit before being queued for delivery. If the daily limit has been reached, the message is deferred until the next day's reset.

## Starting warmup

### Via the API

```bash
curl -X POST https://mail.example.com/api/v1/warmup \
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

### Via the dashboard

1. Log into the Vectis admin dashboard
2. Navigate to **Deliverability** > **IP Warmup**
3. Click **Start Warmup**
4. Enter the IP address and an optional label
5. The warmup begins immediately

## Monitoring warmup progress

### Via the API

```bash
# List all warmup entries with status
curl https://mail.example.com/api/v1/warmup \
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
      "daily_limit": 500,
      "daily_sent": 342,
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
| `daily_limit` | Maximum messages allowed today |
| `daily_sent` | Messages sent so far today |
| `utilization_pct` | Percentage of daily limit used |
| `schedule_limit` | The recommended limit for the current day (matches `daily_limit` unless manually adjusted) |
| `active` | `true` while warmup is in progress, `false` when complete |

### Via the dashboard

The Deliverability section of the dashboard shows a warmup progress card with:

- Current day and daily limit
- A progress bar showing utilization
- A chart of daily sends over the warmup period
- Projected completion date

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
- **RBL status**: Run `vectis rbl check` or check the API endpoint to ensure you are not listed on any blocklists

### Do not pause and restart

If you pause sending for several days during warmup, you may lose the reputation you have built. The schedule is designed for 30 consecutive days. If you must pause, resume from the day you stopped -- do not restart from day 1.

## Stopping or removing warmup

### Remove warmup tracking

```bash
curl -X DELETE https://mail.example.com/api/v1/warmup/WARMUP_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Removing warmup tracking immediately removes all sending limits for that IP. Only do this if:

- The 30-day warmup is complete (it auto-deactivates)
- You are migrating an IP that already has an established reputation
- You are testing in a development environment

## When warmup is complete

After day 30, Vectis automatically deactivates the warmup entry for the IP. From this point:

- All sending limits are removed
- The IP is considered fully warmed
- You should continue to follow [deliverability best practices](/guides/deliverability) to maintain your reputation

Your IP's reputation is not permanent. Even after warmup, sudden volume spikes, high bounce rates, or spam complaints can damage it. Treat warmup as the foundation, not a one-time task.

## Common mistakes

### Sending too much too soon

The most common mistake. Even if you have 10,000 messages queued, the warmup schedule exists for a reason. If you need to send high volumes from day one, consider using an established relay service for the first 30 days while your IP warms up.

### Ignoring bounces during warmup

A 5% bounce rate during warmup will damage your reputation far more than the same rate from an established IP. Clean your lists aggressively before starting.

### Warming up with low-quality traffic

Sending password reset emails to inactive accounts or re-engagement campaigns during warmup is counterproductive. These messages have low engagement and high complaint rates -- exactly the signals that harm your reputation.

### Not setting up authentication first

SPF, DKIM, and DMARC must be fully configured and passing before you start warmup. Sending unauthenticated mail from a new IP is a recipe for immediate blocking. See the [DKIM, SPF & DMARC guide](/guides/dkim-spf-dmarc).

### Sharing an IP with untrusted senders

If multiple domains share the same IP and one domain sends spam, all domains on that IP suffer. In Vectis, you control all domains on your server, so this is only a concern if you host mail for external parties.

## Warmup for multiple IPs

If your deployment uses multiple outbound IPs (for example, separate IPs for transactional and marketing email), each IP must be warmed independently. Create a separate warmup entry for each:

```bash
# Transactional IP
curl -X POST https://mail.example.com/api/v1/warmup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"ip_address": "203.0.113.10", "label": "Transactional"}'

# Marketing IP
curl -X POST https://mail.example.com/api/v1/warmup \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"ip_address": "203.0.113.11", "label": "Marketing"}'
```

## Next steps

- [DKIM, SPF & DMARC configuration](/guides/dkim-spf-dmarc) -- set up authentication before warmup
- [Email deliverability best practices](/guides/deliverability) -- maintain your reputation after warmup
- [DNS setup](/getting-started/dns-setup) -- ensure PTR, MX, and A records are correct
