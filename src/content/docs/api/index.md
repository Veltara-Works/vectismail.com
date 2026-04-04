---
title: "API Overview & Authentication"
description: "Base URL, authentication methods, response format, error codes, pagination, and rate limiting for the Vectis Mail REST API."
---

The Vectis Mail API is a RESTful JSON API for managing domains, mailboxes, aliases, sending email, and administering your mail server. All endpoints are versioned under a single base path.

## Base URL

```
https://mail.example.com/api/v1
```

Replace `mail.example.com` with your Vectis hostname. All requests and responses use `application/json`.

## Authentication

Every endpoint requires authentication except `GET /health`, `GET /version`, and `POST /auth/login`. Vectis supports two authentication methods.

### Session cookie (admin dashboard)

The admin dashboard authenticates via `POST /auth/login`, which sets a signed `HttpOnly` session cookie named `vectis_session`. The cookie is `Secure`, `SameSite=Strict`, and expires after the configured session TTL (default 24 hours).

```bash
curl -X POST https://mail.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}' \
  -c cookies.txt
```

If the admin has TOTP enabled, the first call returns a temporary `totp_session` token. Complete login by sending the TOTP code:

```bash
curl -X POST https://mail.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"totp_session": "abc123...", "totp_code": "482910"}'
```

### Bearer token (API key)

API keys are prefixed with `vectis_` and authenticate via the `Authorization` header. Keys can be scoped to specific domains and have configurable rate limits.

```bash
curl https://mail.example.com/api/v1/domains \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

API keys inherit the role of the admin who created them. They can be further restricted to specific domains via `scoped_domain_ids` at creation time. See the [Admin & RBAC API](/api/admin) for key management endpoints.

## Response format

Every response uses a consistent JSON envelope:

```json
{
  "data": { ... },
  "error": null,
  "meta": {
    "request_id": "0192abc0-def1-7000-8000-000000000001",
    "timestamp": "2026-04-04T12:00:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data` | object/array | The response payload. Null on error. |
| `error` | object/null | Error details. Null on success. |
| `error.code` | string | Machine-readable error code (e.g. `DOMAIN_EXISTS`). |
| `error.message` | string | Human-readable error message. |
| `error.details` | object/null | Additional context for the error, when available. |
| `meta.request_id` | string | UUIDv7 identifying this request. Include in support tickets. |
| `meta.timestamp` | string | ISO 8601 UTC timestamp of the response. |
| `meta.pagination` | object/null | Present on paginated endpoints. See [Pagination](#pagination). |

## Error codes

Errors return the appropriate HTTP status code along with a structured error object.

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `INVALID_JSON` | Malformed JSON request body. |
| 400 | `MISSING_FIELDS` | Required fields are absent. |
| 400 | `INVALID_PERIOD` | Invalid period parameter for analytics. |
| 400 | `INVALID_PAGINATION` | Malformed cursor or limit value. |
| 401 | `AUTH_REQUIRED` | No session cookie or Bearer token provided. |
| 401 | `SESSION_INVALID` | Session expired or token invalid. |
| 401 | `API_KEY_INVALID` | API key not found or expired. |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password. |
| 401 | `TOTP_INVALID` | Invalid TOTP code. |
| 403 | `FORBIDDEN` | Insufficient role or domain access. |
| 403 | `API_KEY_DOMAIN_SCOPE` | API key does not have access to the requested domain. |
| 403 | `DOMAIN_INACTIVE` | The domain exists but is deactivated. |
| 404 | `NOT_FOUND` | Resource does not exist. |
| 409 | `DOMAIN_EXISTS` | Domain already registered. |
| 409 | `CONFLICT` | Resource has dependents (e.g. domain has mailboxes). |
| 409 | `ORCHESTRATOR_BUSY` | Orchestrator is currently running an operation. |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests or sending rate exceeded. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

Example error response:

```json
{
  "data": null,
  "error": {
    "code": "DOMAIN_EXISTS",
    "message": "Domain example.com already exists"
  },
  "meta": {
    "request_id": "0192abc0-def1-7000-8000-000000000001",
    "timestamp": "2026-04-04T12:00:00Z"
  }
}
```

## Pagination

List endpoints use cursor-based pagination. Pass `cursor` and `limit` as query parameters.

| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `cursor` | string | _(none)_ | -- | Opaque cursor from a previous response. |
| `limit` | integer | 50 | 200 | Number of items to return. |

Paginated responses include a `pagination` object in the `meta` field:

```json
{
  "data": [ ... ],
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "pagination": {
      "next_cursor": "MjAyNi0wNC0wNFQxMjowMDowMFo=",
      "has_more": true
    }
  }
}
```

To fetch the next page, pass `next_cursor` as the `cursor` parameter:

```bash
curl "https://mail.example.com/api/v1/domains?cursor=MjAyNi0wNC0wNFQxMjowMDowMFo=&limit=50" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

When `has_more` is `false`, you have reached the last page.

## Sorting and filtering

Most list endpoints support sorting and filtering via query parameters:

| Parameter | Example | Description |
|-----------|---------|-------------|
| `sort` | `created_at` | Field to sort by. |
| `order` | `desc` | Sort direction: `asc` or `desc`. |
| `active` | `true` | Filter by active status (domains, mailboxes). |
| `domain_id` | `uuid` | Filter by domain (mailboxes, aliases, messages). |

## Rate limiting

Rate limiting is enforced at the Traefik reverse proxy layer and is configurable per endpoint group.

| Tier | Applies to | Default limit |
|------|-----------|---------------|
| Authentication | `POST /auth/login` | 5 requests/second (throttled). |
| API key | All authenticated endpoints | 60 requests/minute per key (configurable at key creation). |
| Global | All endpoints | Configurable in `config.yaml`. |

When rate-limited, the API returns HTTP 429 with the `RATE_LIMIT_EXCEEDED` error code.

## Content type

All requests must send `Content-Type: application/json`. Request bodies are limited to 1 MB. The API returns `application/json` for all responses.

## CORS

CORS is disabled by default. If you need to access the API from a custom frontend on a different origin, configure the CORS settings in `config.yaml`.

## API versioning

The API is versioned via the URL prefix (`/api/v1`). Breaking changes will be introduced under a new version prefix (e.g. `/api/v2`). Non-breaking additions (new fields, new endpoints) are made to the current version.

## Audit trail

Every mutating API call (POST, PATCH, DELETE) is recorded in the audit log with the admin ID, action, resource, IP address, and a details object capturing what changed. See the [Admin & RBAC API](/api/admin) for querying the audit log.

## Next steps

- [Domains API](/api/domains) -- manage mail domains and DKIM
- [Mailboxes API](/api/mailboxes) -- create and manage mailboxes
- [Aliases API](/api/aliases) -- email forwarding and catch-all
- [Sending Email](/api/sending) -- send messages via the API
- [Webhooks](/api/webhooks) -- real-time event notifications
- [Messages & Storage API](/api/messages) -- query message history
- [Analytics API](/api/analytics) -- mail volume and deliverability stats
- [Admin & RBAC API](/api/admin) -- authentication, roles, and API keys
