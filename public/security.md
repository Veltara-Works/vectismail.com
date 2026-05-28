# Security — Vectis Mail

Machine-readable security posture for AI agents and procurement reviewers.
Source of truth: https://vectismail.com/privacy/ §11 (technical baseline) + product code.
Last updated: 2026-05-18

---

## TL;DR

Vectis Mail is a **self-hosted** email platform — Veltara Works writes and ships the code, but you operate the server and control the data on it. This file documents the security posture of (a) the **vectismail.com marketing site**, (b) the **Vectis Mail product** as we ship it, and (c) the **licensing channel between your install and ValidonX**.

For data privacy specifically, see https://vectismail.com/privacy/.

---

## Two layers, two scopes

| Layer | Controller | Scope of this document |
|---|---|---|
| `vectismail.com` (marketing + contact + billing-portal proxy) | Veltara Works | Sections 1–4 |
| Your Vectis Mail install (`mail.<your-host>`) | You | Sections 5–9 (vendor defaults and primitives) |
| Licensing/billing channel (your install ↔ `api.validonx.com`) | Veltara Works operates both endpoints | Section 10 |

---

## 1. Transport security (vectismail.com)

- **TLS 1.2+** enforced on every public endpoint. TLS 1.3 served by Cloudflare Pages's edge for any modern browser. (Note: Cloudflare Pages does not honour the zone-level `min_tls_version` setting; the effective public floor for vectismail.com is TLS 1.2. The zone is configured at TLS 1.3 to future-proof any non-Pages routes.)
- **HSTS preload** is on. Response header: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`.
- **No mixed content**: every asset on every page loads over HTTPS.
- **HTTP → HTTPS** redirect at the edge (zone setting `always_use_https: on`).

## 2. Cookies and tracking

- The marketing site sets **no first-party cookies**.
- Cloudflare's bot-management runtime sets `__cf_bm` (short-lived, ≤30 min, strictly functional).
- **No analytics, no behavioural pixels, no session-replay** — Google Analytics, Facebook Pixel, LinkedIn Insight, X tracking, Hotjar, FullStory, etc. are all absent.
- No advertising cookies → no cookie banner.

## 3. Forms and data handling

- `vectismail.com/contact/` is the only data-collecting surface on the marketing site. It posts to a Cloudflare Pages Function which forwards the submission to a mailbox on `mail.vectismail.com`.
- `vectismail.com/account/billing` proxies to a ValidonX endpoint that mints a Stripe Billing Portal session. We never see card numbers or PCI-scope data; Stripe handles all of that.
- The page that follows the Stripe Portal (`/account/billing/done/`) is `noindex,nofollow` and excluded from the sitemap.

## 4. Third-party processors (vectismail.com)

| Processor | Role | What we share | Transfer mechanism |
|---|---|---|---|
| **Cloudflare** | DNS, CDN, edge compute, bot management | Connection metadata (IP, user-agent, URL) | EU–US DPF + Standard Contractual Clauses |
| **Stripe** | Payment processor (via ValidonX) | Cardholder details (we never see these), receipt name + email | EU–US DPF + SCC |
| **GitHub (Microsoft)** | Source-code hosting | Public interactions only (issues, PRs, discussions) | EU–US DPF + SCC |
| **ValidonX** | Licensing/subscription platform | Not a third party — operated by Veltara Works, the same controller | n/a |

## 5. Product security baseline (Vectis Mail install)

These are the defaults you get when you `vectis apply` a fresh install. You control all of them on your own server.

### Authentication

- **Argon2id** for admin password hashing. Industry-standard memory-hard KDF.
- **TOTP MFA** available via the admin UI. Secrets stored encrypted at rest.
- **OIDC SSO** in the Pro tier — supports Google, Azure AD, Keycloak. Replaces password auth for admin users.
- **Domain-scoped API keys** for the REST API. Per-domain revocation. No single global API key.

### Encryption at rest

- **AES-256-GCM** for TOTP secrets and backup encryption material.
- **TLS 1.2+** between every internal Docker container that crosses a network boundary (see §6 below).
- Mail spool on disk is plain-text (industry standard — Postfix/Dovecot defaults). Backup tarballs are encrypted by default.

### Authorization and audit

- **RBAC** with predefined roles: super_admin, domain_admin, user. Custom roles supported in Pro.
- **Audit log** records every admin action (domain create/update/delete, mailbox CRUD, license changes, role changes). 90-day retention by default; configurable.
- Audit-log endpoint requires `super_admin` (post-2026-05-17 — was previously `domain_admin` on some installs; verify post-`v0.1.12`).

## 6. Network model (Vectis Mail install)

- **Four Docker networks** with strict separation:
  - `frontend` (Traefik + public-facing services)
  - `mail` (Postfix, Dovecot, Rspamd)
  - `data` (Postgres, Valkey)
  - `orchestrator` (orchestrator container with Docker socket — the only container that gets it)
- Each service joins only the networks it needs.
- The `data` network is `internal: true` — no published ports, no inbound paths from the internet.
- Only the orchestrator container has the Docker socket mounted. No other service can manipulate containers.

## 7. Database security

Three Postgres roles enforced by `init-users.sql`:

| Role | Privilege | Used by |
|---|---|---|
| `vectis_postfix` | read-only on `domains`, `mailboxes`, `aliases`, etc. | Postfix LDAP-style lookups |
| `vectis_dovecot` | read-only on the same tables | Dovecot auth + userdb |
| `vectis_api` | full DML + DDL (migrations) on its own schema | Go API control plane |

Postfix and Dovecot **cannot** write to the database. Compromise of those processes does not enable database modification.

## 8. Update model (atomic, rollback-safe)

- `vectis apply` runs a 6-phase pipeline: **snapshot → migrate → pull → deploy → health-check → complete.**
- Each phase has a defined rollback path.
- Database migrations are forward-only; rollback = restore from the `snapshot` phase pg_dump.
- An advisory lock prevents concurrent `apply` operations.
- Self-heal: if a previous apply crashed mid-pipeline, the next apply detects and refuses with a remediation message; manual `vectis recover` re-runs the rollback path.

## 9. What is NOT in scope today

Be transparent about what we don't ship yet:

- **SOC 2 / ISO 27001 attestation** — not yet pursued. Pro tier exists; Enterprise tier (Phase 4, later in 2026) is the target framework for formal attestations.
- **Hardware-security-module (HSM) integration** — not on the current roadmap.
- **Customer-managed encryption keys (CMEK)** — not currently supported. Database is encrypted at the volume level if you configure your host's disk encryption; we don't manage it.
- **Continuous SAST/DAST in CI** — partial. Govulncheck runs on releases; Semgrep + CodeQL ran for the 2026-05-17 pre-Stripe-flip audit (0 Critical findings) but are not yet wired into every PR.
- **Penetration test (third-party)** — pending. Planned alongside Enterprise tier.
- **Bug bounty programme** — not yet. Security reports welcomed via `support@vectismail.com`.
- **Managed hosting** — Vectis Mail is self-hosted only. We do not offer a managed/hosted version. (See pricing.md "What is NOT included".)

## 10. Licensing channel (install ↔ api.validonx.com)

When your install hits Pro, it makes outbound calls to ValidonX's licensing endpoint:

- **POST** `https://api.validonx.com/api/v1/integration/licensing/resolve`
- **Auth**: `X-API-Key: <service_key>` header (per-tenant key, issued at purchase)
- **Body**: `{license_key, features?}` — server-side tenant resolution from the API key; no tenant ID or domain on the wire
- **Frequency**: cache TTL is 5 minutes. Resolve call frequency depends on entitlement checks.
- **Content of the wire**: the call carries the license key and optionally a list of features to check. It carries **no** mailbox lists, **no** message content, **no** recipient addresses, and **no** IP addresses of your end users.
- **Offline tolerance**: 30-day offline grace period for Pro entitlements. If `api.validonx.com` is unreachable, your install continues operating at Pro for up to 30 days from the last successful resolve. After that, Pro features fall back to Starter limits but **mail delivery is never affected** — Postfix and Dovecot keep running.
- **Feature-gate failure mode**: if a feature check cannot be resolved, the gate **denies by default** (post-2026-05-02 fix — earlier versions had a pass-through bypass on unconfigured installs).

## 11. Reporting a security issue

Send details to **`support@vectismail.com`** with `SECURITY` in the subject line. We aim to acknowledge within 1 business day (AU hours, GMT+10/+11).

We do not currently run a bug bounty. We do reply to every responsible disclosure and credit researchers in release notes when they prefer attribution.

## 12. Source-available verification

Vectis Mail's core is source-available under the **Business Source License 1.1** (auto-converts to Apache 2.0 four years after each version's first public release); Pro features are gated by a commercial license key (ValidonX). The full source is on GitHub at https://github.com/Veltara-Works/vectis. Build reproducibility is supported via the released Docker images (`ghcr.io/veltara-works/vectis-*`) and tagged source revisions.

You can audit the code, build from source, and verify the security claims above against the implementation. We encourage it.

---

## Source

- Live privacy policy (companion document): https://vectismail.com/privacy/
- Llms.txt: https://vectismail.com/llms.txt
- Pricing (machine-readable): https://vectismail.com/pricing.md
- Source repository: https://github.com/Veltara-Works/vectis
- Reporting channel: support@vectismail.com
