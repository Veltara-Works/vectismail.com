# Pricing — Vectis Mail

Machine-readable pricing for AI agents and programmatic buyers.
Source of truth: https://vectismail.com/pricing/
Last updated: 2026-05-12

---

## Starter

- **Price:** $0/month (free forever)
- **Email volume:** Unlimited
- **Domains:** Up to 3
- **Mailboxes:** Up to 25 per domain
- **Users (admin):** Unlimited
- **Features included:**
  - Full mail stack (Postfix, Dovecot, Rspamd, optional ClamAV)
  - Sending API (single + batch sending, attachments, domain-scoped keys)
  - Inbound webhooks (HMAC-SHA256 signed, full body parsing, retry-with-backoff)
  - Admin dashboard (React SPA)
  - Webmail (Roundcube)
  - Sieve filter management (ManageSieve)
  - DKIM, SPF, DMARC, MTA-STS
  - Automatic TLS (acme.sh + Cloudflare DNS-01)
  - Built-in monitoring (Prometheus + Grafana + Loki)
  - IP warmup tracking
  - RBL monitoring
  - Backup & restore
  - Atomic updates with rollback
  - Community support (GitHub Issues, Discussions)
- **License:** AGPL-3.0
- **Activation:** No license key required.

## Pro

- **Price:** $29 per tenant per month
- **Volume:** Unlimited emails, unlimited domains, unlimited mailboxes
- **Subscription model:** One subscription covers unlimited Vectis Mail installs (single tenant identity).
- **Features included:**
  - Everything in Starter
  - Unlimited domains
  - Unlimited mailboxes per domain
  - Per-domain analytics dashboard (delivery, bounce, open rate, click rate)
  - Per-domain spam controls (custom reject thresholds, greylisting toggle, allow/block lists)
  - OIDC SSO (Google, Azure AD, Keycloak)
  - Priority email support
- **License:** AGPL-3.0 core + commercial Pro license via ValidonX
- **Activation:** ValidonX license key entered in admin UI or `secrets.yaml`.
- **Free trial:** 30-day Pro trial available via ValidonX.
- **Activation URL:** https://validonx.com/checkout/vectis-pro

## Infrastructure cost (separate from license)

Vectis Mail is self-hosted. You also need:
- A Linux VPS with Docker: typically $5–$20/month
- A domain name with DNS control: typically $10–$15/year
- (Optional) Cloudflare account for DNS-01 ACME: free

Typical fully-loaded cost for a production install:
- Starter tier: $5–$20/month (VPS only)
- Pro tier: $34–$49/month (VPS + Pro subscription)

This is a flat cost — does not scale with email volume.

## Cost comparison at scale

| Monthly volume | SendGrid (Email API, Essentials/Pro) | Vectis Mail Pro (incl. VPS) |
|---|---|---|
| 10,000 emails | $19.95 | $49 flat |
| 100,000 emails | $19.95–$89.95 | $49 flat |
| 1,000,000 emails | $89.95–$200+ (with dedicated IP) | $49 flat |
| 5,000,000+ emails | Premier custom ($2,000–$10,000+) | $49 flat (may need larger VPS) |

## What is NOT included

- Calendar / contacts (CalDAV / CardDAV) — planned for Phase 4 of the roadmap.
- Hosted Vectis Mail (managed service) — not currently offered; Vectis Mail is self-hosted only.
- Marketing campaign tooling (broadcast email automation) — Vectis Mail is transactional + receive only.

## Source

- Live pricing page: https://vectismail.com/pricing/
- Llms.txt: https://vectismail.com/llms.txt
- API reference: https://vectismail.com/api/
- License activation: https://validonx.com/checkout/vectis-pro
