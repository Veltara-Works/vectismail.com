---
title: "Mailboxes API"
description: "Create, list, update, and delete mailboxes via the Vectis Mail API. Manage quotas, passwords, and display names."
---

Mailboxes represent individual email accounts within a domain. Each mailbox has a local part (the part before `@`), a password hashed with Argon2id, a quota, and a Maildir on disk. Postfix and Dovecot pick up new mailboxes immediately via SQL lookups -- no service reload is needed.

All endpoints require authentication. `domain_admin` users are scoped to their assigned domains.

## List mailboxes

```
GET /api/v1/mailboxes
```

Returns a paginated list of mailboxes.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `domain_id` | string (UUID) | Yes (for `domain_admin`) | Filter by domain. |
| `active` | boolean | No | Filter by active status. |
| `cursor` | string | No | Pagination cursor. |
| `limit` | integer | No | Items per page (default 50, max 200). |

**Example:**

```bash
curl "https://mail.example.com/api/v1/mailboxes?domain_id=0192abc0-..." \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000010",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "local_part": "alice",
      "display_name": "Alice Johnson",
      "quota_mb": 2048,
      "active": true,
      "created_at": "2026-03-20T14:30:00Z",
      "updated_at": "2026-03-20T14:30:00Z"
    },
    {
      "id": "0192abc0-def1-7000-8000-000000000011",
      "domain_id": "0192abc0-def1-7000-8000-000000000001",
      "local_part": "bob",
      "display_name": "Bob Smith",
      "quota_mb": 1024,
      "active": true,
      "created_at": "2026-03-21T09:15:00Z",
      "updated_at": "2026-03-21T09:15:00Z"
    }
  ],
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "pagination": { "next_cursor": "", "has_more": false }
  }
}
```

## Create mailbox

```
POST /api/v1/mailboxes
```

Creates a new mailbox. The password is hashed with Argon2id before storage. A Maildir directory structure is created on disk at `/var/vectis/mail/<domain>/<local_part>/Maildir/{cur,new,tmp}`.

**Request body:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `domain_id` | string (UUID) | Yes | -- | ID of the parent domain. |
| `local_part` | string | Yes | -- | Local part of the email address (before `@`). |
| `password` | string | Yes | -- | Plaintext password (hashed server-side with Argon2id). |
| `display_name` | string | No | `null` | Full name of the mailbox owner. |
| `quota_mb` | integer | No | `1024` | Mailbox quota in megabytes. |
| `active` | boolean | No | `true` | Whether the mailbox can send and receive mail. |

**Example:**

```bash
curl -X POST https://mail.example.com/api/v1/mailboxes \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "local_part": "alice",
    "password": "a-strong-passphrase",
    "display_name": "Alice Johnson",
    "quota_mb": 2048
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000010",
    "domain_id": "0192abc0-def1-7000-8000-000000000001",
    "local_part": "alice",
    "display_name": "Alice Johnson",
    "quota_mb": 2048,
    "active": true,
    "created_at": "2026-04-04T12:00:00Z",
    "updated_at": "2026-04-04T12:00:00Z"
  },
  "meta": { "request_id": "...", "timestamp": "..." }
}
```

**Validation rules:**

- The domain must exist and be active.
- `local_part` must be unique within the domain.
- If the domain has `max_mailboxes` set, creation fails if the limit is reached.

**Errors:**

| Code | Status | Description |
|------|--------|-------------|
| `MISSING_FIELDS` | 400 | Required fields missing. |
| `DOMAIN_NOT_FOUND` | 404 | Domain ID does not exist. |
| `DOMAIN_INACTIVE` | 403 | Domain is deactivated. |
| `CONFLICT` | 409 | Mailbox already exists for this local_part and domain. |

## Get mailbox

```
GET /api/v1/mailboxes/{id}
```

Returns full details for a single mailbox, including quota usage.

```bash
curl https://mail.example.com/api/v1/mailboxes/0192abc0-def1-7000-8000-000000000010 \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Update mailbox

```
PATCH /api/v1/mailboxes/{id}
```

Updates mailbox settings. Only include the fields you want to change.

**Request body (all fields optional):**

| Field | Type | Description |
|-------|------|-------------|
| `password` | string | New password (re-hashed with Argon2id). |
| `display_name` | string | Updated display name. |
| `quota_mb` | integer | New quota in megabytes. |
| `active` | boolean | Enable or disable the mailbox. |

**Example -- update quota and display name:**

```bash
curl -X PATCH https://mail.example.com/api/v1/mailboxes/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"quota_mb": 4096, "display_name": "Alice M. Johnson"}'
```

**Example -- change password:**

```bash
curl -X PATCH https://mail.example.com/api/v1/mailboxes/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"password": "new-strong-passphrase"}'
```

## Delete mailbox

```
DELETE /api/v1/mailboxes/{id}
```

Deletes a mailbox. Requires the `X-Confirm-Delete: true` header to prevent accidental deletion.

Optionally archive the mailbox's mail data before deletion by including `{"archive": true}` in the request body. Archived mail is saved to `/var/vectis/archives/<domain>/<local_part>-<timestamp>/`.

**Example:**

```bash
curl -X DELETE https://mail.example.com/api/v1/mailboxes/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "X-Confirm-Delete: true" \
  -H "Content-Type: application/json" \
  -d '{"archive": true}'
```

**Response:**

```json
{
  "data": {
    "message": "Mailbox deleted",
    "archived": true,
    "archive_path": "/var/vectis/archives/example.com/alice-20260404-120000/"
  }
}
```

Without the confirmation header, the API returns:

```json
{
  "error": {
    "code": "CONFIRMATION_REQUIRED",
    "message": "Set X-Confirm-Delete: true header to confirm mailbox deletion"
  }
}
```

## Password hashing

Passwords are hashed server-side using Argon2id with the following parameters:

| Parameter | Value |
|-----------|-------|
| Memory | 65,536 KB (64 MB) |
| Iterations | 3 |
| Parallelism | 4 |
| Format | PHC string (`$argon2id$v=19$m=65536,t=3,p=4$salt$hash`) |

Passwords are never stored in plaintext or returned in API responses.

## Related

- [Domains API](/docs/api/domains) -- manage the parent domains
- [Aliases API](/docs/api/aliases) -- forward mail to or from mailboxes
- [Sending Email](/docs/api/sending) -- send mail from a mailbox via the API
- [CLI mailbox commands](/docs/cli/commands#mailbox-management) -- manage mailboxes from the command line
