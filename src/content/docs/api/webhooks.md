---
title: "Webhooks"
description: "Register webhook endpoints to receive real-time notifications for mail events including delivery, bounce, spam, and full inbound message parsing."
---

Webhooks deliver real-time HTTP POST notifications to your application when mail events occur. You register a URL, choose which events to subscribe to, and Vectis signs each delivery so you can verify authenticity.

Webhook management endpoints require the `admin` or `super_admin` role.

## Create webhook

```
POST /api/v1/webhooks
```

Registers a new webhook endpoint.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | HTTPS URL to receive webhook payloads. Must use `https://`. |
| `events` | array | Yes | Event types to subscribe to. At least one required. |
| `domain_id` | string | No | Scope to a specific domain. Null = all domains (global). |

**Example:**

```bash
curl -X POST https://mail.example.com/api/v1/webhooks \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://app.example.com/hooks/vectis",
    "events": ["mail.sent", "mail.bounced", "mail.received.full"]
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000030",
    "url": "https://app.example.com/hooks/vectis",
    "events": ["mail.sent", "mail.bounced", "mail.received.full"],
    "domain_id": null,
    "active": true,
    "created_by": "0192abc0-def1-7000-8000-000000000050",
    "created_at": "2026-04-04T12:00:00Z",
    "secret": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

The `secret` is only returned at creation time. Store it securely -- you will need it to verify webhook signatures.

## List webhooks

```
GET /api/v1/webhooks
```

Returns all registered webhooks.

```bash
curl https://mail.example.com/api/v1/webhooks \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000030",
      "url": "https://app.example.com/hooks/vectis",
      "events": ["mail.sent", "mail.bounced", "mail.received.full"],
      "domain_id": null,
      "active": true,
      "created_by": "0192abc0-def1-7000-8000-000000000050",
      "created_at": "2026-04-04T12:00:00Z"
    }
  ],
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

The `secret` is never returned in list responses.

## Delete webhook

```
DELETE /api/v1/webhooks/{id}
```

Removes a webhook registration.

```bash
curl -X DELETE https://mail.example.com/api/v1/webhooks/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Event types

| Event | Description |
|-------|-------------|
| `mail.sent` | A message was accepted by Postfix for delivery (outbound). |
| `mail.delivered` | A message was successfully delivered to the remote server. |
| `mail.bounced` | A message bounced (permanent or temporary failure). |
| `mail.failed` | A message failed to send. |
| `mail.received` | An inbound message was delivered to a local mailbox (metadata only). |
| `mail.received.full` | An inbound message was delivered, with full parsed body and attachments. |
| `mail.spam` | An inbound message was flagged as spam by Rspamd. |
| `*` | Subscribe to all event types (wildcard). |

## Webhook payload format

Each webhook delivery is an HTTP POST with a JSON body:

```json
{
  "id": "<message-id>",
  "event": "mail.sent",
  "timestamp": "2026-04-04T12:00:00Z",
  "data": { ... }
}
```

### mail.sent payload

```json
{
  "id": "<20260404120000.abc123@example.com>",
  "event": "mail.sent",
  "timestamp": "2026-04-04T12:00:00Z",
  "data": {
    "message_id": "<20260404120000.abc123@example.com>",
    "from": "alice@example.com",
    "to": ["bob@recipient.com"],
    "subject": "Project update",
    "domain": "example.com"
  }
}
```

### mail.received payload

```json
{
  "id": "<20260404120500.xyz789@sender.com>",
  "event": "mail.received",
  "timestamp": "2026-04-04T12:05:00Z",
  "data": {
    "message_id": "<20260404120500.xyz789@sender.com>",
    "from": "external@sender.com",
    "to": "alice@example.com",
    "domain": "example.com",
    "subject": "Re: Project update",
    "size": 4521,
    "queue_id": "ABC123DEF"
  }
}
```

### mail.received.full payload

This event includes the full parsed email body, headers, attachments, and SMTP envelope. It is designed for inbound routing integrations (e.g. support ticket creation, CRM ingestion).

```json
{
  "id": "<20260404120500.xyz789@sender.com>",
  "event": "mail.received.full",
  "timestamp": "2026-04-04T12:05:00Z",
  "data": {
    "message_id": "<20260404120500.xyz789@sender.com>",
    "from": { "name": "External User", "email": "external@sender.com" },
    "to": [
      { "name": "Alice Johnson", "email": "alice@example.com" }
    ],
    "cc": [],
    "reply_to": { "name": "", "email": "external@sender.com" },
    "subject": "Re: Project update",
    "body_text": "Hi Alice,\n\nThanks for the update. Here are my notes...\n\nBest,\nExternal User",
    "body_html": "<p>Hi Alice,</p><p>Thanks for the update. Here are my notes...</p>",
    "attachments": [
      {
        "filename": "notes.pdf",
        "content_type": "application/pdf",
        "size": 28450,
        "content_base64": "JVBERi0xLjQK..."
      }
    ],
    "headers": {
      "Date": "Fri, 04 Apr 2026 12:05:00 +0000",
      "MIME-Version": "1.0",
      "Content-Type": "multipart/mixed; boundary=\"---abc123\""
    },
    "envelope": {
      "mail_from": "external@sender.com",
      "rcpt_to": ["alice@example.com"]
    },
    "domain": "example.com",
    "size": 34982,
    "spam_score": 1.2,
    "spam_action": "no action",
    "queue_id": "ABC123DEF"
  }
}
```

The `envelope` field contains the SMTP-level sender and recipient addresses, which may differ from the `from` and `to` header addresses (e.g. when mail is forwarded or sent via a mailing list).

### mail.spam payload

```json
{
  "id": "<20260404121000.spam456@spammer.com>",
  "event": "mail.spam",
  "timestamp": "2026-04-04T12:10:00Z",
  "data": {
    "message_id": "<20260404121000.spam456@spammer.com>",
    "from": "spammer@spammer.com",
    "to": "alice@example.com",
    "domain": "example.com",
    "spam_score": 18.5,
    "spam_action": "reject"
  }
}
```

## Signature verification

Every webhook delivery includes an `X-Vectis-Signature` header containing an HMAC-SHA256 signature of the request body, signed with the webhook's `secret`.

To verify a delivery:

1. Read the raw request body.
2. Compute `HMAC-SHA256(secret, raw_body)`.
3. Compare the hex-encoded result to the `X-Vectis-Signature` header value.

**Verification example (Node.js):**

```javascript
const crypto = require('crypto');

function verifyWebhook(secret, body, signature) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}

// In your handler:
app.post('/hooks/vectis', (req, res) => {
  const signature = req.headers['x-vectis-signature'];
  const rawBody = req.rawBody; // ensure raw body is available

  if (!verifyWebhook(WEBHOOK_SECRET, rawBody, signature)) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  console.log(`Received ${event.event} for message ${event.id}`);
  res.status(200).send('OK');
});
```

**Verification example (Python):**

```python
import hmac
import hashlib

def verify_webhook(secret: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(
        secret.encode(), body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
```

**Verification example (Go):**

```go
func verifyWebhook(secret string, body []byte, signature string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(body)
    expected := hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(expected), []byte(signature))
}
```

Always use constant-time comparison to prevent timing attacks.

## Retry policy

If your endpoint returns a non-2xx status code or the connection times out, Vectis retries the delivery with exponential backoff:

| Attempt | Delay after failure |
|---------|-------------------|
| 1st retry | 30 seconds |
| 2nd retry | 2 minutes |
| 3rd retry | 15 minutes |
| 4th retry | 1 hour |
| 5th retry | 2 hours |

After 5 failed attempts, the delivery is abandoned. Webhook deliveries time out after 10 seconds.

Your endpoint should return HTTP 200 as quickly as possible. Process webhook payloads asynchronously if your handling logic is slow.

## Domain scoping

Webhooks can be scoped to a specific domain by setting `domain_id` in the creation request. A scoped webhook only receives events for that domain. A global webhook (no `domain_id`) receives events for all domains.

## Related

- [Sending Email](/api/sending) -- triggers `mail.sent` events
- [Messages & Storage API](/api/messages) -- query message history
- [Analytics API](/api/analytics) -- aggregate event statistics
