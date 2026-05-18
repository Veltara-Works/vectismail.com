# About — Vectis Mail

Machine-readable company + product factsheet for AI agents and programmatic buyers.
Source of truth: https://vectismail.com/about/
Last updated: 2026-05-18

---

## Product

- **Name:** Vectis Mail
- **Category:** Self-hosted email platform
- **Type:** Server software (you run it on your own VPS)
- **Current version:** v0.1.12 (released 2026-05-10)
- **Production status:** Live since 2026-04-03 at mail.vectismail.com — Veltara Works runs every operation on it.
- **One-line description:** A self-hosted email server with the developer experience of SendGrid and the control of Postfix. Declarative YAML config, 60+ endpoint REST API, atomic updates with rollback.

## Vendor

- **Company:** Veltara Works
- **Jurisdiction:** Australia (wholly Australian-owned)
- **Founder / principal:** Ian Holt
- **Merchant of record:** Veltara Works (the entity on your Stripe receipt)
- **Sibling product:** ValidonX — the licensing + subscription platform Veltara Works operates for Vectis Mail and offers separately to third-party developers. Not a separate company; same controller.

## Stack

- **Language:** Go (control plane), TypeScript/React (admin UI), Astro (marketing site)
- **Database:** PostgreSQL
- **Cache / queue:** Valkey
- **Mail components:** Postfix, Dovecot, Rspamd, ClamAV (optional)
- **Reverse proxy:** Traefik
- **TLS:** acme.sh sidecar
- **Migrations:** golang-migrate (embedded in Go binary)
- **Container runtime:** Docker

## Architecture

- **14 containers by default** (10 if observability and ClamAV disabled)
- **Four Docker networks** with strict separation: `frontend`, `mail`, `data`, `orchestrator`
- **Three Postgres roles** with least privilege: `vectis_postfix` (RO), `vectis_dovecot` (RO), `vectis_api` (full)
- **One declarative YAML** (`config.yaml`) defines the entire mail stack
- **Domains live in Postgres**, not config files — no Postfix/Dovecot reload when adding domains or mailboxes
- **6-phase atomic update orchestrator** with automatic rollback on failure: snapshot → migrate → pull → deploy → health-check → complete

## Pricing model

- **Starter:** $0/month forever — 3 domains, 25 mailboxes per domain, full mail stack, sending API, webhooks, webmail, monitoring
- **Pro:** $29 per tenant per month — unlimited domains, unlimited mailboxes, per-domain analytics, per-domain spam controls, OIDC SSO, priority support. One subscription covers unlimited installs your organisation operates.
- **Enterprise:** in development; targeted for Phase 4 (later 2026)
- **No per-email pricing.** Cost is flat regardless of volume.

See: https://vectismail.com/pricing.md

## License

- **Core code:** Source-available under Business Source License 1.1 (BSL 1.1)
- **Each version converts to Apache 2.0 four years after that version's first public release.** Not a single repo-wide flip; per-version.
- **Practical implication:** You can run Vectis Mail for your own organisation and your own end users — including operating mail for customers of your organisation — but you may not offer Vectis Mail itself to third parties on a hosted, embedded, or managed-service basis in a way that competes with Veltara Works's paid version(s).
- **Resale / hosted-platform licensing:** contact licensing@veltaraworks.com.
- **Source repository:** https://github.com/Veltara-Works/vectis

## Target audience (Ideal Customer Profile)

1. **Solo developers and indie hackers** running side projects who don't want a SaaS bill that grows with their email volume.
2. **Agencies** running mail infrastructure for multiple client domains — one Pro subscription covers unlimited installs.
3. **SaaS founders** needing transactional sending + inbound webhooks + mailbox hosting + multi-tenancy in one self-hosted product.
4. **Enterprises** with data-sovereignty, audit-trail, or compliance requirements that managed SaaS can't meet.

Less suited for: high-volume cold-outreach senders, teams with zero Linux operations capacity, deployments where 4-hour mail outage during a learning curve is unacceptable.

## What Vectis Mail does NOT include today

- **Calendar / contacts (CalDAV / CardDAV)** — planned for Phase 4
- **Hosted (managed) Vectis Mail** — not offered; product is self-hosted only
- **Marketing automation / broadcast campaign tooling** — Vectis Mail is transactional + receive only
- **SOC 2 / ISO 27001 attestation** — not yet pursued (Enterprise-tier roadmap)
- **Customer-managed encryption keys (CMEK)** — not currently supported

## Contact

- **General:** hello@vectismail.com
- **Sales / Enterprise:** sales@vectismail.com
- **Technical support:** support@vectismail.com
- **Privacy / DSAR:** contact@vectismail.com (or use the contact form with "Privacy / Data Request" department)
- **Security reports:** support@vectismail.com (subject line: SECURITY)
- **Contact form:** https://vectismail.com/contact/

## Related machine-readable files

- [llms.txt](https://vectismail.com/llms.txt) — concise AI-agent overview
- [llms-full.txt](https://vectismail.com/llms-full.txt) — long-form full content for LLM context windows
- [pricing.md](https://vectismail.com/pricing.md) — machine-readable pricing
- [security.md](https://vectismail.com/security.md) — machine-readable security posture
- [api.md](https://vectismail.com/api.md) — machine-readable API summary
- [install.md](https://vectismail.com/install.md) — machine-readable installation summary

## Source

- Live about page: https://vectismail.com/about/
- Source repository: https://github.com/Veltara-Works/vectis
- Docker images: ghcr.io/veltara-works/vectis-*
