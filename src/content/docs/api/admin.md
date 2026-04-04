---
title: "Admin & RBAC API"
description: "Authentication endpoints, TOTP multi-factor authentication, OIDC SSO, admin management, role-based access control, session management, and API key management."
---

The Admin API covers authentication, multi-factor authentication, admin user management, role-based access control, session management, and API key lifecycle.

## Authentication

### Login

```
POST /api/v1/auth/login
```

Authenticates an admin and creates a session. No authentication required.

**Request body (step 1 -- password):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Admin email address. |
| `password` | string | Yes | Admin password. |

```bash
curl -X POST https://mail.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}'
```

**Response (no TOTP):**

```json
{
  "data": {
    "admin": {
      "id": "0192abc0-def1-7000-8000-000000000050",
      "email": "admin@example.com",
      "role": "super_admin",
      "totp_enabled": false,
      "last_login_at": "2026-04-03T18:30:00Z"
    },
    "session_id": "0192abc0-def1-7000-8000-000000000060",
    "expires_at": "2026-04-05T12:00:00Z"
  }
}
```

A `vectis_session` cookie is set automatically (`HttpOnly`, `Secure`, `SameSite=Strict`).

**Response (TOTP required):**

If the admin has TOTP enabled, the first call returns a temporary session:

```json
{
  "data": {
    "requires_totp": true,
    "totp_session": "a1b2c3d4e5f6..."
  }
}
```

**Request body (step 2 -- TOTP code):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `totp_session` | string | Yes | Temporary token from step 1. |
| `totp_code` | string | Yes | 6-digit TOTP code from authenticator app. |

```bash
curl -X POST https://mail.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"totp_session": "a1b2c3d4e5f6...", "totp_code": "482910"}'
```

The TOTP session expires after 5 minutes. If the code is not provided in time, the admin must restart login from step 1.

### Get current admin

```
GET /api/v1/auth/me
```

Returns the authenticated admin's profile.

```bash
curl https://mail.example.com/api/v1/auth/me \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "id": "0192abc0-def1-7000-8000-000000000050",
    "email": "admin@example.com",
    "role": "super_admin",
    "totp_enabled": true,
    "oidc_provider": null,
    "last_login_at": "2026-04-04T12:00:00Z"
  }
}
```

### Logout

```
POST /api/v1/auth/logout
```

Invalidates the current session and clears the session cookie.

```bash
curl -X POST https://mail.example.com/api/v1/auth/logout \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

### Logout all sessions

```
POST /api/v1/auth/logout-all
```

Invalidates all sessions for the current admin across all devices.

```bash
curl -X POST https://mail.example.com/api/v1/auth/logout-all \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## TOTP multi-factor authentication

### Setup TOTP

```
POST /api/v1/auth/totp/setup
```

Generates a TOTP secret and returns a provisioning URI for scanning with an authenticator app. The secret is stored encrypted but TOTP is not yet active -- you must verify a code to complete enrollment.

```bash
curl -X POST https://mail.example.com/api/v1/auth/totp/setup \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": {
    "provisioning_uri": "otpauth://totp/Vectis:admin@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Vectis&algorithm=SHA1&digits=6&period=30"
  }
}
```

Encode the `provisioning_uri` as a QR code for scanning, or manually enter the secret into an authenticator app.

### Verify TOTP

```
POST /api/v1/auth/totp/verify
```

Completes TOTP enrollment by verifying the first code from the authenticator app. After this, TOTP will be required at login.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | 6-digit TOTP code from authenticator app. |

```bash
curl -X POST https://mail.example.com/api/v1/auth/totp/verify \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"code": "482910"}'
```

### Disable TOTP

```
DELETE /api/v1/auth/totp
```

Disables TOTP for the current admin. Requires the current TOTP code for verification to prevent unauthorized disabling.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Current valid TOTP code. |

```bash
curl -X DELETE https://mail.example.com/api/v1/auth/totp \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"code": "159263"}'
```

## OIDC single sign-on

Vectis supports OpenID Connect (OIDC) SSO for admin authentication. Providers are configured in `secrets.yaml`.

### List providers

```
GET /api/v1/auth/oidc/providers
```

Returns the list of configured OIDC providers. No authentication required.

### Initiate SSO login

```
GET /api/v1/auth/oidc/login/{provider}
```

Redirects the browser to the OIDC provider's authorization endpoint.

### SSO callback

```
GET /api/v1/auth/oidc/callback/{provider}
```

Handles the OIDC provider's callback, creates a session, and redirects to the admin dashboard.

### Disconnect OIDC

```
DELETE /api/v1/auth/oidc/disconnect
```

Removes the OIDC link from the current admin account. Requires authentication.

## Admin management

### List admins

```
GET /api/v1/admins
```

Returns all admin accounts. Accessible to all authenticated roles.

```bash
curl https://mail.example.com/api/v1/admins \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000050",
      "email": "admin@example.com",
      "role": "super_admin",
      "totp_enabled": true,
      "last_login_at": "2026-04-04T12:00:00Z"
    },
    {
      "id": "0192abc0-def1-7000-8000-000000000051",
      "email": "ops@example.com",
      "role": "admin",
      "totp_enabled": false,
      "last_login_at": "2026-04-03T09:00:00Z"
    }
  ]
}
```

### Create admin

```
POST /api/v1/admins
```

Creates a new admin account. Requires `super_admin` role.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Admin email address. |
| `password` | string | Yes | Initial password. |
| `role` | string | No | Role assignment (default `admin`). |

```bash
curl -X POST https://mail.example.com/api/v1/admins \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"email": "newadmin@example.com", "password": "strong-password", "role": "domain_admin"}'
```

### Delete admin

```
DELETE /api/v1/admins/{id}
```

Deletes an admin account. Requires `super_admin` role. All sessions for the admin are invalidated. Audit log entries are preserved with the admin ID set to null.

```bash
curl -X DELETE https://mail.example.com/api/v1/admins/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Roles

Vectis uses three roles with escalating privileges:

| Role | Permissions |
|------|------------|
| `domain_admin` | Manage mailboxes and aliases for assigned domains only. View analytics for assigned domains. Send from assigned domains. |
| `admin` | Everything `domain_admin` can do, plus: manage domains, manage webhooks, view abuse dashboard, manage Sieve filters, access all domains. |
| `super_admin` | Everything `admin` can do, plus: manage other admins, manage configuration, orchestrator control, backup/restore, view audit logs, system health, cluster management. |

Domain admins are assigned to specific domains via a junction table. They can only see and manage resources within those domains.

## Session management

### List sessions

```
GET /api/v1/auth/sessions
```

Returns all active sessions for the current admin.

```bash
curl https://mail.example.com/api/v1/auth/sessions \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000060",
      "ip_address": "203.0.113.10",
      "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "created_at": "2026-04-04T12:00:00Z",
      "expires_at": "2026-04-05T12:00:00Z"
    }
  ]
}
```

### Revoke a session

```
DELETE /api/v1/auth/sessions/{id}
```

Invalidates a specific session. Use this to sign out a particular device.

```bash
curl -X DELETE https://mail.example.com/api/v1/auth/sessions/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## API key management

API keys provide programmatic access to the Vectis API. They use the `vectis_` prefix and authenticate via the `Authorization: Bearer` header. Keys inherit the role of the admin who created them and can be further scoped to specific domains.

### List API keys

```
GET /api/v1/api-keys
```

Returns API keys. `super_admin` sees all keys; other roles see only their own.

```bash
curl https://mail.example.com/api/v1/api-keys \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

**Response:**

```json
{
  "data": [
    {
      "id": "0192abc0-def1-7000-8000-000000000070",
      "admin_id": "0192abc0-def1-7000-8000-000000000050",
      "name": "Production sending key",
      "key_prefix": "vectis_sk_abc1",
      "scoped_domain_ids": ["0192abc0-def1-7000-8000-000000000001"],
      "rate_limit": 60,
      "last_used_at": "2026-04-04T11:55:00Z",
      "expires_at": null,
      "created_at": "2026-03-15T10:00:00Z"
    }
  ]
}
```

### Create API key

```
POST /api/v1/api-keys
```

Creates a new API key. The raw key is returned only in this response -- store it securely.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | Yes | -- | Descriptive name for the key. |
| `scoped_domain_ids` | array | No | `[]` | Restrict key to specific domains. Empty = all accessible domains. |
| `rate_limit` | integer | No | `60` | Requests per minute. Set to `0` for unlimited. |
| `expires_in_days` | integer | No | _(never)_ | Number of days until the key expires. `0` or omit for no expiry. |

```bash
curl -X POST https://mail.example.com/api/v1/api-keys \
  -H "Authorization: Bearer vectis_sk_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Transactional sending",
    "scoped_domain_ids": ["0192abc0-def1-7000-8000-000000000001"],
    "rate_limit": 120,
    "expires_in_days": 90
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "key": "vectis_sk_f8a2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    "api_key": {
      "id": "0192abc0-def1-7000-8000-000000000071",
      "admin_id": "0192abc0-def1-7000-8000-000000000050",
      "name": "Transactional sending",
      "key_prefix": "vectis_sk_f8a2",
      "scoped_domain_ids": ["0192abc0-def1-7000-8000-000000000001"],
      "rate_limit": 120,
      "expires_at": "2026-07-03T12:00:00Z",
      "created_at": "2026-04-04T12:00:00Z"
    }
  }
}
```

The `key` field contains the full API key. It is only shown at creation time. The server stores only the SHA-256 hash -- the raw key cannot be recovered.

### Revoke API key

```
DELETE /api/v1/api-keys/{id}
```

Revokes an API key immediately. Admins can revoke their own keys; `super_admin` can revoke any key.

```bash
curl -X DELETE https://mail.example.com/api/v1/api-keys/0192abc0-... \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

## Audit log

### List audit entries

```
GET /api/v1/audit
```

Returns audit log entries. `domain_admin` users see only events related to their assigned domains.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `cursor` | string | Pagination cursor. |
| `limit` | integer | Items per page (default 50, max 200). |

```bash
curl "https://mail.example.com/api/v1/audit?limit=20" \
  -H "Authorization: Bearer vectis_sk_abc123..."
```

### Export audit log

```
GET /api/v1/audit/export
```

Exports the full audit log. Requires `super_admin` role.

## Related

- [API Overview](/docs/api/) -- authentication methods and response format
- [Domains API](/docs/api/domains) -- resources managed by RBAC
- [CLI Commands](/docs/cli/commands) -- manage admins from the command line
