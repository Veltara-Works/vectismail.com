---
title: "Messages & Storage API"
description: "Query message history with filtering, pagination, and full-text search across sent and received emails via the Vectis Mail API."
---

The Messages API provides access to metadata for all messages that pass through your Vectis server -- both inbound and outbound. Message metadata is stored automatically when mail is sent via the [Sending API](/docs/api/sending) or received by Postfix.

All endpoints require authentication. `domain_admin` users must specify a `domain_id` and can only access domains assigned to them.

## List messages

```
GET /api/v1/messages
```

Returns a paginated, filterable list of message metadata.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain_id` | string (UUID) | Yes (for `domain_admin`) | Filter by domain. |
| `direction` | string | No | `inbound` or `outbound`. |
| `status` | string | No | Message status (see table below). |
| `search` | string | No | Full-text search on subject and sender. |
| `sender` | string | No | Filter by sender email address. |
| `cursor` | string | No | Pagination cursor. |
| `limit` | integer | No | Items per page (default 50, max 200). |

**Status values:**

| Status | Description |
|--------|-------------|
| `sent` | Outbound message accepted by Postfix. |
| `delivered` | Inbound message delivered to local mailbox. |
| `spam` | Inbound message flagged as spam by Rspamd. |
| `bounced` | Message bounced. |
| `failed` | Message delivery failed. |

**Example -- list recent outbound messages:**

```bash
curl "https://mail.example.com/api/v1/messages?domain_id=0192abc0-...&direction=outbound&limit=20" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Example -- search by subject:**

```bash
curl "https://mail.example.com/api/v1/messages?domain_id=0192abc0-...&search=invoice" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000040",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "message_id": "<20260404120000.abc123@example.com>",
      "direction": "outbound",
      "sender": "alice@example.com",
      "recipients": ["bob@recipient.com"],
      "subject": "Invoice #2026-04-001",
      "status": "sent",
      "size_bytes": 12540,
      "spam_score": null,
      "spam_action": null,
      "queue_id": null,
      "created_at": "2026-04-04T12:00:00Z"
    },
    {
      "id": "0192abc0-def1-7000-8000-000000000041",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "message_id": "<20260404120500.xyz789@sender.com>",
      "direction": "inbound",
      "sender": "external@sender.com",
      "recipients": ["alice@example.com"],
      "subject": "Re: Invoice #2026-04-001",
      "status": "delivered",
      "size_bytes": 4521,
      "spam_score": 1.2,
      "spam_action": "no action",
      "queue_id": "ABC123DEF",
      "created_at": "2026-04-04T12:05:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "pagination": {
      "next_cursor": "MjAyNi0wNC0wNFQxMjowNTowMFo=",
      "has_more": true
    }
  }
}
```

## Get a single message

```
GET /api/v1/messages/{id}
```

Returns full metadata for a single message.

```bash
curl https://mail.example.com/api/v1/messages/0192abc0-def1-7000-8000-000000000040 \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000040",
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "message_id": "<20260404120000.abc123@example.com>",
    "direction": "outbound",
    "sender": "alice@example.com",
    "recipients": ["bob@recipient.com"],
    "subject": "Invoice #2026-04-001",
    "status": "sent",
    "size_bytes": 12540,
    "spam_score": null,
    "spam_action": null,
    "queue_id": null,
    "created_at": "2026-04-04T12:00:00Z"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**Errors:**

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Message does not exist. |
| `FORBIDDEN` | 403 | No access to the message's domain. |
| `DOMAIN_REQUIRED` | 400 | `domain_admin` users must specify `domain_id`. |

## Full-text search

The `search` parameter performs full-text search across the `subject` and `sender` fields. It supports partial matching and is case-insensitive.

```bash
# Find messages about invoices
curl "https://mail.example.com/api/v1/messages?search=invoice" \
  -H "Authorization: Bearer vectis_sk_abc123..."

# Find messages from a specific sender
curl "https://mail.example.com/api/v1/messages?sender=alice@example.com" \
  -H "Authorization: Bearer vectis_sk_abc123..."

# Combine filters
curl "https://mail.example.com/api/v1/messages?domain_id=0192abc0-...&direction=inbound&status=spam&limit=10" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Message fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Vectis internal ID. |
| `domain_id` | string (UUID) | Domain the message belongs to. |
| `message_id` | string | RFC 5322 Message-ID header value. |
| `direction` | string | `inbound` or `outbound`. |
| `sender` | string | Sender email address. |
| `recipients` | array of strings | Recipient email addresses. |
| `subject` | string | Email subject line. |
| `status` | string | Current message status. |
| `size_bytes` | integer | Message size in bytes (inbound only). |
| `spam_score` | number/null | Rspamd spam score (inbound only). |
| `spam_action` | string/null | Rspamd action taken (inbound only). |
| `queue_id` | string/null | Postfix queue ID (inbound only). |
| `created_at` | string | ISO 8601 timestamp when the message was recorded. |

## How messages are stored

- **Outbound:** Metadata is stored when a message is submitted via `POST /send` or `POST /send/batch`.
- **Inbound:** Metadata is stored when Postfix delivers a message to Dovecot and sends a notification to the Vectis API.

The Messages API stores metadata only, not message body content. The actual email content lives in the Dovecot Maildir storage. For full inbound message content, use the [`mail.received.full` webhook](/docs/api/webhooks).

## Related

- [Sending Email](/docs/api/sending) -- creates outbound message records
- [Webhooks](/docs/api/webhooks) -- real-time notification of message events
- [Analytics API](/docs/api/analytics) -- aggregate message statistics
