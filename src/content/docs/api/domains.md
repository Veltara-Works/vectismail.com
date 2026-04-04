---
title: "Domains API"
description: "Create, list, update, and delete mail domains. Manage DKIM keys and run deliverability checks via the Vectis Mail API."
---

Domains are the core organisational unit in Vectis. Each domain is stored in Postgres and picked up by Postfix and Dovecot via live SQL lookups -- no service reload is needed when you add or modify a domain.

All endpoints require authentication. Domain mutations (POST, PATCH, DELETE) require the `admin` or `super_admin` role. Read endpoints are accessible to all roles, with `domain_admin` users scoped to their assigned domains.

## List domains

```
GET /api/v1/domains
```

Returns a paginated list of domains.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `active` | boolean | Filter by active status. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Items per page (default 50, max 200). |
| `sort` | string | Sort field (e.g. `created_at`, `name`). |
| `order` | string | `asc` or `desc`. |

**Example:**

```bash
curl "https://mail.example.com/api/v1/domains?active=true&limit=10" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000001",
      "name": "example.com",
      "active": true,
      "dkim_enabled": true,
      "dkim_selector": "202604",
      "spam_threshold": 15.0,
      "max_mailboxes": null,
      "mailbox_count": 5,
      "alias_count": 3,
      "created_at": "2026-03-15T10:00:00Z",
      "updated_at": "2026-03-15T10:00:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "timestamp": "2026-04-04T12:00:00Z",
    "pagination": {
      "next_cursor": "",
      "has_more": false
    }
  }
}
```

## Create domain

```
POST /api/v1/domains
```

Creates a new domain. Automatically generates a DKIM key pair and configures Rspamd for DKIM signing.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Fully qualified domain name (e.g. `example.com`). |
| `spam_threshold` | number | No | Rspamd score threshold. Default: `15.0`. |
| `max_mailboxes` | integer | No | Maximum mailboxes allowed. Null = unlimited. |

**Example:**

```bash
curl -X POST https://mail.example.com/api/v1/domains \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"name": "example.com"}'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000001",
    "name": "example.com",
    "active": true,
    "dkim_enabled": true,
    "dkim_selector": "202604",
    "spam_threshold": 15.0,
    "max_mailboxes": null,
    "dkim_record": {
      "type": "TXT",
      "name": "202604._domainkey.example.com",
      "value": "v=DKIM1; k=rsa; p=MIIBIjANBgkqh..."
    },
    "created_at": "2026-04-04T12:00:00Z",
    "updated_at": "2026-04-04T12:00:00Z"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**What happens on creation:**

1. Domain name is validated and inserted into Postgres.
2. An RSA-2048 DKIM key pair is generated with a date-based selector.
3. The private key is stored at `/var/vectis/dkim/<domain>/`.
4. Rspamd is reloaded to pick up the DKIM signing configuration.
5. Postfix and Dovecot pick up the new domain immediately via SQL lookups.

**Errors:**

| Code | Status | Description |
|------|--------|-------------|
| `DOMAIN_EXISTS` | 409 | Domain already registered. |
| `MISSING_FIELDS` | 400 | `name` is required. |

## Get domain

```
GET /api/v1/domains/{id}
```

Returns full details for a single domain, including DKIM status and mailbox count.

```bash
curl https://mail.example.com/api/v1/domains/0192abc0-def1-7000-8000-000000000001 \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Update domain

```
PATCH /api/v1/domains/{id}
```

Updates domain settings. Only the fields you include in the request body are changed.

**Request body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `active` | boolean | Enable or disable the domain. |
| `spam_threshold` | number | Per-domain Rspamd score threshold. |
| `max_mailboxes` | integer/null | Maximum mailboxes. Null = unlimited. |

```bash
curl -X PATCH https://mail.example.com/api/v1/domains/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"spam_threshold": 12.0, "active": true}'
```

## Delete domain

```
DELETE /api/v1/domains/{id}
```

Deletes a domain. Fails with `409 Conflict` if the domain still has mailboxes or aliases. You must delete all mailboxes and aliases first to prevent accidental data loss.

```bash
curl -X DELETE https://mail.example.com/api/v1/domains/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Error (409):**

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete domain: 5 mailboxes and 3 aliases still exist",
    "details": { "mailbox_count": 5, "alias_count": 3 }
  }
}
```

## Verify domain DNS

```
POST /api/v1/domains/{id}/verify
```

Runs DNS verification checks for the domain (MX, SPF, DKIM TXT record, DMARC). Returns the status of each record.

```bash
curl -X POST https://mail.example.com/api/v1/domains/0192abc0-.../verify \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "domain": "example.com",
    "mx": { "status": "pass", "records": ["mail.example.com"] },
    "spf": { "status": "pass", "record": "v=spf1 mx a ip4:203.0.113.10 -all" },
    "dkim": { "status": "pass", "selector": "202604" },
    "dmarc": { "status": "warn", "record": "v=DMARC1; p=none" }
  }
}
```

## Get DKIM record

```
GET /api/v1/domains/{id}/dkim
```

Returns the DKIM public key as a DNS TXT record value, ready to copy into your DNS provider.

```bash
curl https://mail.example.com/api/v1/domains/0192abc0-.../dkim \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "selector": "202604",
    "dns_name": "202604._domainkey.example.com",
    "dns_type": "TXT",
    "dns_value": "v=DKIM1; k=rsa; p=MIIBIjANBgkqh..."
  }
}
```

## Generate DKIM key

```
POST /api/v1/domains/{id}/dkim/generate
```

Generates a new DKIM key pair. This replaces any existing key for the domain. Use this if you need to regenerate keys (e.g. after a key compromise).

```bash
curl -X POST https://mail.example.com/api/v1/domains/0192abc0-.../dkim/generate \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Rotate DKIM key

```
POST /api/v1/domains/{id}/dkim/rotate
```

Rotates the DKIM key with a new selector. The old key remains active during a configurable transition window so that messages signed with the old key can still be verified. After the transition, update your DNS to remove the old selector.

```bash
curl -X POST https://mail.example.com/api/v1/domains/0192abc0-.../dkim/rotate \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "old_selector": "202601",
    "new_selector": "202604",
    "new_dns_name": "202604._domainkey.example.com",
    "new_dns_value": "v=DKIM1; k=rsa; p=MIIBIjANBgkqh...",
    "transition_note": "Keep the old DNS record for 48 hours to allow in-flight messages to verify."
  }
}
```

## Deliverability check

```
GET /api/v1/domains/{id}/deliverability
```

Runs a comprehensive deliverability assessment for the domain, checking SPF, DKIM, DMARC, PTR records, and TLS configuration.

```bash
curl https://mail.example.com/api/v1/domains/0192abc0-.../deliverability \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "domain": "example.com",
    "score": 95,
    "checks": {
      "spf": { "status": "pass", "detail": "v=spf1 mx a ip4:203.0.113.10 -all" },
      "dkim": { "status": "pass", "detail": "RSA-2048, selector 202604" },
      "dmarc": { "status": "pass", "detail": "v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com" },
      "ptr": { "status": "pass", "detail": "203.0.113.10 -> mail.example.com" },
      "tls": { "status": "pass", "detail": "Valid certificate, TLS 1.3" }
    }
  }
}
```

## Related

- [Mailboxes API](/docs/api/mailboxes) -- create mailboxes under a domain
- [Aliases API](/docs/api/aliases) -- create aliases under a domain
- [CLI domain commands](/docs/cli/commands#domain-management) -- manage domains from the command line
