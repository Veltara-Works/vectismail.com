---
title: "Aliases API"
description: "Create, list, update, and delete email aliases and catch-all addresses via the Vectis Mail API."
---

Aliases forward incoming mail to one or more destination addresses. They take effect immediately via Postfix SQL lookups -- no service reload is needed.

All endpoints require authentication. `domain_admin` users are scoped to their assigned domains.

## List aliases

```
GET /api/v1/aliases
```

Returns a paginated list of aliases.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `domain_id` | string (UUID) | Filter by domain. Required for `domain_admin` role. |
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Items per page (default 50, max 200). |

**Example:**

```bash
curl "https://mail.example.com/api/v1/aliases?domain_id=0192abc0-..." \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000020",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "source_local_part": "info",
      "destination": "alice@example.com",
      "active": true,
      "created_at": "2026-03-22T11:00:00Z",
      "updated_at": "2026-03-22T11:00:00Z"
    },
    {
      "id": "0192abc0-def1-7000-8000-000000000021",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "source_local_part": "",
      "destination": "catchall@example.com",
      "active": true,
      "created_at": "2026-03-22T11:05:00Z",
      "updated_at": "2026-03-22T11:05:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "pagination": { "next_cursor": "", "has_more": false }
  }
}
```

## Create alias

```
POST /api/v1/aliases
```

Creates a new alias.

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain_id` | string (UUID) | Yes | ID of the domain this alias belongs to. |
| `source_local_part` | string | Yes | Local part to match. Use empty string `""` for catch-all. |
| `destination` | string | Yes | Destination email address(es). Comma-separated for multiple. |
| `active` | boolean | No | Defaults to `true`. |

**Example -- standard alias:**

```bash
curl -X POST https://mail.example.com/api/v1/aliases \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "source_local_part": "info",
    "destination": "alice@example.com"
  }'
```

This creates `info@example.com` which forwards to `alice@example.com`.

**Example -- multiple destinations:**

```bash
curl -X POST https://mail.example.com/api/v1/aliases \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "source_local_part": "support",
    "destination": "alice@example.com,bob@example.com"
  }'
```

**Example -- catch-all alias:**

```bash
curl -X POST https://mail.example.com/api/v1/aliases \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "source_local_part": "",
    "destination": "catchall@example.com"
  }'
```

A catch-all alias matches any address at the domain that does not have a corresponding mailbox or explicit alias. Set `source_local_part` to an empty string `""` to create one.

**Response (201 Created):**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000020",
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "source_local_part": "info",
    "destination": "alice@example.com",
    "active": true,
    "created_at": "2026-04-04T12:00:00Z",
    "updated_at": "2026-04-04T12:00:00Z"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**Validation rules:**

- The domain must exist and be active.
- `source_local_part` must be unique within the domain (only one alias per source address).
- Aliases cannot chain -- an alias destination cannot be another alias source within the same domain.
- `destination` can be a local mailbox address or an external address (or a mix).

**Errors:**

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_FIELDS` | 400 | Required fields missing. |
| `DOMAIN_NOT_FOUND` | 404 | Domain ID does not exist. |
| `CONFLICT` | 409 | An alias with this source_local_part already exists on the domain. |

## Get alias

```
GET /api/v1/aliases/{id}
```

Returns details for a single alias.

```bash
curl https://mail.example.com/api/v1/aliases/0192abc0-def1-7000-8000-000000000020 \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Update alias

```
PATCH /api/v1/aliases/{id}
```

Updates an alias. Only include the fields you want to change.

**Request body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `destination` | string | New destination address(es). |
| `active` | boolean | Enable or disable the alias. |

**Example:**

```bash
curl -X PATCH https://mail.example.com/api/v1/aliases/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"destination": "alice@example.com,carol@example.com", "active": true}'
```

## Delete alias

```
DELETE /api/v1/aliases/{id}
```

Deletes an alias. The change takes effect immediately.

```bash
curl -X DELETE https://mail.example.com/api/v1/aliases/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": { "message": "Alias deleted" },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

## Catch-all behaviour

When `source_local_part` is an empty string, the alias acts as a catch-all for the domain. Postfix evaluates aliases in this order:

1. Check for an exact mailbox match (`local_part@domain`).
2. Check for an exact alias match (`source_local_part@domain`).
3. Check for a catch-all alias (empty `source_local_part` for the domain).
4. If none match, reject the message (no such user).

Only one catch-all alias can exist per domain (enforced by the unique constraint on `domain_id` + `source_local_part`).

## Destination formats

The `destination` field accepts several formats:

| Format | Example | Description |
|--------|---------|-------------|
| Local address | `alice@example.com` | Deliver to a local mailbox. |
| External address | `forward@gmail.com` | Forward to an external address. |
| Multiple addresses | `alice@example.com,bob@other.com` | Comma-separated list, up to 10 recipients. |

## Related

- [Domains API](/docs/api/domains) -- manage the parent domains
- [Mailboxes API](/docs/api/mailboxes) -- manage the destination mailboxes
