# API — Vectis Mail

Machine-readable REST API summary for AI agents and developers.
Full reference: https://vectismail.com/api/
Last updated: 2026-05-18

---

## Base URL

```
https://<your-vectis-host>/api/v1/
```

Every Vectis Mail install exposes its own API surface — there is no centralised vectismail.com API for end-user installs (that's the point of self-hosting). Replace `<your-vectis-host>` with the hostname of your Vectis Mail install (e.g. `mail.your-domain.com`).

## Authentication

Two distinct auth modes, used for different surfaces:

### Domain-scoped API keys (for sending, webhooks, message storage)

```
Authorization: Bearer <api_key>
```

- Issued per domain via the admin UI or `POST /api/v1/domains/{id}/api-keys`
- Revocable independently — compromising one domain's key does not affect others
- Rate-limited per key

### Session cookies (for admin UI / RBAC operations)

- Set after `POST /api/v1/auth/login` with username + password (+ TOTP if MFA enabled)
- Required for admin endpoints (domain CRUD, mailbox CRUD, audit log, system operations)
- 3-tier RBAC: `super_admin`, `admin`, `domain_admin`
- OIDC SSO supported in Pro tier (Google, Azure AD, Keycloak)

## Endpoint surface (60+ endpoints)

### Sending

- `POST /api/v1/send` — single message send
- `POST /api/v1/send/batch` — batch up to 100 messages per call
- Payloads: HTML + text bodies, attachments, custom headers, optional opens/clicks tracking

### Webhooks (inbound + outbound events)

- `POST /api/v1/webhooks` — register an outbound webhook endpoint
- Outbound events: `message.delivered`, `message.bounced`, `message.complained`, `message.opened`, `message.clicked`, plus mail.* events for the receive-side
- Inbound webhooks: parsed inbound mail POSTed to your URL — body text, HTML, attachments, SMTP envelope, all HMAC-SHA256 signed with exponential-backoff retry

### Domains

- `GET    /api/v1/domains`           list domains
- `POST   /api/v1/domains`           create domain (auto-generates DKIM key + DNS recommendations)
- `GET    /api/v1/domains/{id}`      get domain (DKIM, SPF, DMARC verification status)
- `PATCH  /api/v1/domains/{id}`      update domain settings
- `DELETE /api/v1/domains/{id}`      delete domain (cascades to mailboxes after confirmation)

### Mailboxes

- `GET    /api/v1/mailboxes`         list mailboxes (filter by domain)
- `POST   /api/v1/mailboxes`         create mailbox
- `PATCH  /api/v1/mailboxes/{id}`    update (password rotation, quota change, etc.)
- `DELETE /api/v1/mailboxes/{id}`    delete mailbox

### Aliases

- `GET / POST / PATCH / DELETE /api/v1/aliases`  alias management, including catch-all support

### Messages & storage

- `GET /api/v1/messages` — query sent + received message metadata
- Filters: domain, direction, status, sender, recipient, date range, full-text search
- Cursor-based pagination

### Analytics (Pro)

- `GET /api/v1/analytics/domains/{id}` — per-domain delivery, bounce, open, click rate
- Time-series, daily aggregates, top senders, top recipients

### Admin

- `GET /api/v1/audit` — audit log (super_admin only)
- `GET /api/v1/audit/export` — export to CSV
- User management, role assignment, system health

## Rate limits

- Default: 60 requests / minute per API key
- Configurable per domain in `config.yaml`
- Sending endpoints have separate rate-limit pools to prevent abuse
- 429 responses include `Retry-After` header

## Error format

All errors return JSON:

```json
{
  "error": "<short-error-code>",
  "message": "<human-readable description>",
  "details": { /* optional structured context */ }
}
```

Standard HTTP status codes apply (400, 401, 403, 404, 409, 422, 429, 500, 502, 503).

## Pagination

Cursor-based for list endpoints:

```
GET /api/v1/messages?limit=50&cursor=eyJpZCI6...
```

Response includes `next_cursor` for forward pagination.

## Webhook signing (inbound mail)

Vectis signs every inbound webhook with HMAC-SHA256 using the per-webhook secret. Verify by computing HMAC over the raw request body and comparing to the `X-Vectis-Signature` header. Reject any request where signatures don't match — replay protection relies on this.

## Authentication for the licensing channel (vendor side)

Vectis Mail installs communicate with `api.validonx.com` (operated by Veltara Works) for Pro license verification:

- `POST https://api.validonx.com/api/v1/integration/licensing/resolve`
- Auth: `X-API-Key: <service_key>` header
- Body: `{license_key, features?}`
- 5-minute cache TTL on the install side
- Offline grace through the current paid period (the license's paid-through date)
- Carries no end-user data — only the install's license key

End users don't interact with this endpoint; their Vectis Mail install does it on their behalf.

## SDK availability

Officially supported: HTTP/JSON only (no SDK lock-in). Community SDKs (Python, Go, Node.js) tracked at https://github.com/Veltara-Works/vectis/discussions.

## API stability commitment

- **v0.x** — pre-1.0; breaking changes possible between minor versions but documented in release notes
- **v1.0+** (target: Phase 4) — semver-strict; breaking changes only at major versions

Current breaking-change policy + release notes: https://vectismail.com/release-notes/

## Related files

- [llms.txt](https://vectismail.com/llms.txt) — AI-agent overview with API context
- [llms-full.txt](https://vectismail.com/llms-full.txt) — long-form reference including more API examples
- [security.md](https://vectismail.com/security.md) — authentication and authorization model
- Full API reference: https://vectismail.com/api/
