---
title: "Analytics API"
description: "Query mail volume statistics, bounce rates, spam rates, and per-domain breakdowns. Track email opens and clicks via engagement tracking."
---

The Analytics API provides aggregate mail statistics across your domains. Query totals for sent, received, bounced, and spam messages over configurable time periods with per-domain breakdowns.

All endpoints require authentication. `domain_admin` users can only query analytics for their assigned domains.

## Get analytics

```
GET /api/v1/analytics
```

Returns mail volume statistics for a given time period.

**Query parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `period` | string | `24h` | Time window: `1h`, `24h`, `7d`, `30d`. |
| `granularity` | string | `hourly` | Data point resolution: `hourly` or `daily`. Only used when `domain_id` is set. |
| `domain_id` | string (UUID) | _(none)_ | Filter to a single domain. Omit for all-domain aggregate. |

### All-domain aggregate

When no `domain_id` is specified, the response includes totals across all accessible domains and a per-domain breakdown.

```bash
curl "https://mail.example.com/api/v1/analytics?period=7d" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "period": "7d",
    "totals": {
      "sent": 1542,
      "received": 3891,
      "bounced": 23,
      "spam": 187,
      "failed": 5,
      "size_bytes": 2147483648,
      "bounce_rate": 1.49,
      "spam_rate": 4.81
    },
    "domains": [
      {
        "domain_id": "0192abc0-def1-7000-8000-000000000001",
        "domain_name": "example.com",
        "sent": 1200,
        "received": 3100,
        "bounced": 18,
        "spam": 142,
        "failed": 3,
        "size_bytes": 1610612736
      },
      {
        "domain_id": "0192abc0-def1-7000-8000-000000000002",
        "domain_name": "company.org",
        "sent": 342,
        "received": 791,
        "bounced": 5,
        "spam": 45,
        "failed": 2,
        "size_bytes": 536870912
      }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**Totals fields:**

| Field | Type | Description |
|-------|------|-------------|
| `sent` | integer | Total outbound messages sent. |
| `received` | integer | Total inbound messages received. |
| `bounced` | integer | Total bounced messages. |
| `spam` | integer | Total messages flagged as spam. |
| `failed` | integer | Total failed sends. |
| `size_bytes` | integer | Total inbound message size in bytes. |
| `bounce_rate` | number | Bounced / sent * 100 (percentage). |
| `spam_rate` | number | Spam / received * 100 (percentage). |

### Single-domain time series

When `domain_id` is specified, the response includes granular time-series data.

```bash
curl "https://mail.example.com/api/v1/analytics?domain_id=0192abc0-...&period=24h&granularity=hourly" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response (hourly granularity):**

```json
{
  "data": {
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "period": "24h",
    "granularity": "hourly",
    "stats": [
      {
        "timestamp": "2026-04-03T12:00:00Z",
        "sent": 45,
        "received": 120,
        "bounced": 1,
        "spam": 8,
        "failed": 0,
        "size_bytes": 15728640
      },
      {
        "timestamp": "2026-04-03T13:00:00Z",
        "sent": 52,
        "received": 98,
        "bounced": 0,
        "spam": 5,
        "failed": 0,
        "size_bytes": 12582912
      }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

```bash
curl "https://mail.example.com/api/v1/analytics?domain_id=0192abc0-...&period=30d&granularity=daily" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response (daily granularity):**

```json
{
  "data": {
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "period": "30d",
    "granularity": "daily",
    "stats": [
      {
        "date": "2026-03-06",
        "sent": 180,
        "received": 450,
        "bounced": 3,
        "spam": 22,
        "failed": 0,
        "size_bytes": 94371840
      }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

## Engagement tracking

Vectis supports opt-in open and click tracking for outbound messages. When enabled, the API inserts a transparent 1x1 tracking pixel for opens and rewrites links for click tracking.

### Open tracking

```
GET /api/v1/track/open/{token}
```

This is a public endpoint (no authentication) that returns a 1x1 transparent GIF. When an email client loads the pixel, Vectis records the open event.

The tracking URL is embedded in HTML emails as an `<img>` tag:

```html
<img src="https://mail.example.com/api/v1/track/open/{token}" width="1" height="1" />
```

The `{token}` is an HMAC-signed token encoding the message ID. It cannot be forged or tampered with.

### Click tracking

```
GET /api/v1/track/click/{token}?url={target}
```

This is a public endpoint that records the click and redirects (HTTP 302) to the target URL.

Links in HTML emails are rewritten to pass through the tracking endpoint:

```html
<!-- Original -->
<a href="https://example.com/page">Click here</a>

<!-- Rewritten -->
<a href="https://mail.example.com/api/v1/track/click/{token}?url=https%3A%2F%2Fexample.com%2Fpage">Click here</a>
```

### Tracking statistics

```
GET /api/v1/tracking/stats
```

Returns aggregate open and click metrics. Requires `admin` or `super_admin` role.

```bash
curl https://mail.example.com/api/v1/tracking/stats \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

For persistent per-domain statistics, use the main `GET /analytics` endpoint. The tracking stats endpoint provides counters that reset on server restart.

## Errors

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_PERIOD` | 400 | Period must be `1h`, `24h`, `7d`, or `30d`. |
| `INVALID_GRANULARITY` | 400 | Granularity must be `hourly` or `daily`. |
| `FORBIDDEN` | 403 | No access to the requested domain. |

## Related

- [Messages & Storage API](/docs/api/messages) -- individual message metadata
- [Webhooks](/docs/api/webhooks) -- real-time event notifications
- [Sending Email](/docs/api/sending) -- outbound mail that feeds analytics
