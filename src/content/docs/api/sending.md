---
title: "Sending Email"
description: "Send individual and batch emails via the Vectis Mail API. Covers request format, attachments, domain scoping, and abuse detection."
---

The sending API allows you to send email programmatically through your Vectis server. Messages are submitted to Postfix for delivery, with DKIM signing handled automatically by Rspamd.

All sending endpoints require authentication (session cookie or API key). The sender domain must be managed by Vectis, and the authenticated user must have access to that domain.

## Send a single message

```
POST /api/v1/send
```

Sends a single email message.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | object | Yes | Sender address. `{ "email": "...", "name": "..." }` |
| `to` | array | Yes | Recipient addresses. At least one required. |
| `cc` | array | No | CC recipients. |
| `bcc` | array | No | BCC recipients. |
| `reply_to` | object | No | Reply-to address. |
| `subject` | string | Yes | Email subject line. |
| `text_body` | string | Conditional | Plain text body. At least one of `text_body` or `html_body` required. |
| `html_body` | string | Conditional | HTML body. At least one of `text_body` or `html_body` required. |
| `attachments` | array | No | File attachments (see below). |
| `headers` | object | No | Custom headers. Keys must start with `X-`. |

Each address object has the format:

```json
{ "email": "alice@example.com", "name": "Alice Johnson" }
```

The `name` field is optional in all address objects.

**Example:**

```bash
curl -X POST https://mail.example.com/api/v1/send \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": { "email": "alice@example.com", "name": "Alice Johnson" },
    "to": [
      { "email": "bob@recipient.com", "name": "Bob Smith" }
    ],
    "subject": "Project update",
    "text_body": "Hi Bob,\n\nHere is the latest update.\n\nBest,\nAlice",
    "html_body": "<p>Hi Bob,</p><p>Here is the latest update.</p><p>Best,<br>Alice</p>",
    "headers": {
      "X-Campaign-ID": "update-2026-04"
    }
  }'
```

**Response (200 OK):**

```json
{
  "data": {
    "message_id": "<20260404120000.abc123@example.com>"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

The `message_id` is the RFC 5322 Message-ID assigned by Postfix. Use it to track the message in [webhooks](/docs/api/webhooks) and the [Messages API](/docs/api/messages).

## Send batch messages

```
POST /api/v1/send/batch
```

Sends up to 100 messages in a single request. Each message is processed independently -- failures in one message do not affect others.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | array | Yes | Array of message objects (same format as single send). Max 100 items. |

**Example:**

```bash
curl -X POST https://mail.example.com/api/v1/send/batch \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "from": { "email": "noreply@example.com" },
        "to": [{ "email": "user1@recipient.com" }],
        "subject": "Your weekly report",
        "html_body": "<h1>Weekly Report</h1><p>Here are your stats...</p>"
      },
      {
        "from": { "email": "noreply@example.com" },
        "to": [{ "email": "user2@recipient.com" }],
        "subject": "Your weekly report",
        "html_body": "<h1>Weekly Report</h1><p>Here are your stats...</p>"
      }
    ]
  }'
```

**Response (200 OK):**

```json
{
  "data": {
    "total": 2,
    "succeeded": 2,
    "failed": 0,
    "results": [
      {
        "index": 0,
        "message_id": "<20260404120000.abc123@example.com>"
      },
      {
        "index": 1,
        "message_id": "<20260404120000.abc124@example.com>"
      }
    ]
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**Partial failure example:**

```json
{
  "data": {
    "total": 3,
    "succeeded": 2,
    "failed": 1,
    "results": [
      { "index": 0, "message_id": "<...>" },
      { "index": 1, "error": "Sender domain 'unknown.com' is not managed by this server", "code": "DOMAIN_NOT_FOUND" },
      { "index": 2, "message_id": "<...>" }
    ]
  }
}
```

## Attachments

Attachments are included inline as base64-encoded content.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | string | Yes | File name (e.g. `report.pdf`). |
| `content_type` | string | Yes | MIME type (e.g. `application/pdf`). |
| `content` | string | Yes | Base64-encoded file content. |

**Example with attachment:**

```bash
curl -X POST https://mail.example.com/api/v1/send \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": { "email": "alice@example.com" },
    "to": [{ "email": "bob@recipient.com" }],
    "subject": "Invoice attached",
    "text_body": "Please find the invoice attached.",
    "attachments": [
      {
        "filename": "invoice-2026-04.pdf",
        "content_type": "application/pdf",
        "content": "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PA..."
      }
    ]
  }'
```

## Custom headers

You can include custom headers on outgoing messages. All custom header keys must start with `X-` to avoid conflicts with standard email headers.

```json
{
  "headers": {
    "X-Campaign-ID": "spring-2026",
    "X-Tracking-ID": "usr-12345"
  }
}
```

Headers that do not start with `X-` are rejected with an `INVALID_HEADER` error.

## Domain ownership and API key scoping

The sending API enforces two layers of access control:

1. **Domain ownership:** The sender's domain (the part after `@` in `from.email`) must be a domain managed by your Vectis instance and must be active.

2. **RBAC and API key scoping:** The authenticated user must have access to the sender domain. For API keys created with `scoped_domain_ids`, only those specific domains are allowed.

```
from.email: alice@example.com
              ^^^^^^^^^^^^^ must be an active, managed domain
                             AND the API key must have access to this domain
```

If either check fails, the API returns a `403 Forbidden` error.

## Abuse detection

Vectis includes built-in abuse detection to protect your sending reputation:

- **Mailbox suspension:** If a mailbox has been suspended for abuse, sending from that address is blocked with a `MAILBOX_SUSPENDED` error.
- **Rate limiting:** Per-mailbox and per-domain hourly sending rates are tracked. Exceeding the configured threshold triggers automatic suspension.
- **Spike detection:** Sudden increases in sending volume generate alerts (but do not block sending unless the rate limit is exceeded).

When a mailbox is auto-suspended, the API returns HTTP 429:

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Sending rate exceeded: 500 messages in 1 hour from mailbox (limit: 200)"
  }
}
```

## Webhook events

Each successfully sent message triggers a `mail.sent` [webhook event](/docs/api/webhooks). Batch messages trigger one `mail.sent` event per message.

## Errors

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_FIELDS` | 400 | Required fields missing (from, to, subject, body). |
| `INVALID_SENDER` | 400 | Malformed sender email address. |
| `INVALID_HEADER` | 400 | Custom header key does not start with `X-`. |
| `DOMAIN_NOT_FOUND` | 403 | Sender domain is not managed by this server. |
| `DOMAIN_INACTIVE` | 403 | Sender domain is deactivated. |
| `FORBIDDEN` | 403 | Insufficient access to the sender domain. |
| `API_KEY_DOMAIN_SCOPE` | 403 | API key not scoped to the sender domain. |
| `MAILBOX_SUSPENDED` | 403 | Sending suspended for this mailbox. |
| `RATE_LIMIT_EXCEEDED` | 429 | Sending rate limit exceeded. |
| `SEND_UNAVAILABLE` | 503 | Mail sending is not configured on this server. |
| `SEND_FAILED` | 500 | Failed to submit message to Postfix. |
| `EMPTY_BATCH` | 400 | Batch messages array is empty. |
| `BATCH_TOO_LARGE` | 400 | Batch exceeds 100 messages. |

## Related

- [Webhooks](/docs/api/webhooks) -- receive `mail.sent` and delivery notifications
- [Messages & Storage API](/docs/api/messages) -- query sent message history
- [Analytics API](/docs/api/analytics) -- sending volume statistics
