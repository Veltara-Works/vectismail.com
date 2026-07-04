---
title: Release Highlights
description: A curated tour of what has shipped in Vectis Mail since general availability — spam filtering, backup & DR, native migration, SSO, and the security-hardening and supply-chain work behind the current release.
---

Vectis Mail ships on a fast, steady cadence. This page is a **curated tour of the
milestones** rather than a per-commit changelog — for the full, version-by-version
detail (every fix and internal change), see the
[GitHub Releases](https://github.com/Veltara-Works/vectis/releases).

**Current stable release:** v0.1.39.

## Foundation — general availability

The first GA release established the full self-hosted, multi-tenant mail platform:
Postfix and Dovecot for transport and storage, Rspamd and ClamAV for filtering,
a modern admin console, per-domain DKIM signing, automatic TLS certificates via
Let's Encrypt, and a first-class REST API. One install, your domains, your server —
standard protocols throughout.

## Spam filtering & deliverability

- **Advanced per-domain spam filtering (Pro).** Per-domain reject thresholds,
  greylisting toggles, and sender allow/block lists — tune one tenant without
  touching the rest, with changes taking effect in seconds.
- **DKIM that heals itself.** Signing keys are generated, permissioned, and
  reconciled automatically across upgrades, closing the classic "unsigned mail
  after a config change" gap.
- **Deliverability self-check.** A built-in `vectis domain check` verifies SPF,
  DKIM, DMARC, and DNS alignment so you can confirm a domain is set up to land in
  the inbox before you send.

## Migration & provisioning

- **Native IMAP import.** Move existing mailboxes into Vectis Mail directly over
  IMAP — no external tooling — with progress tracking and cancellation.
- **SCIM 2.0 provisioning (Enterprise).** Automated user lifecycle management from
  your identity provider.

## Single sign-on & Enterprise

- **OIDC SSO (Pro)** and **SAML 2.0 SSO (Enterprise)** for federated login.
- The **Enterprise tier** adds SAML SSO, SCIM provisioning, a business-hours
  support SLA, and GDPR **DSAR export & erasure** — flat per-tenant pricing,
  never per seat.

## Backup & disaster recovery

- Scheduled, encrypted backups with configurable schedule and retention, editable
  from the admin UI, plus off-host synchronisation so a single host failure is
  never a single point of data loss.
- Hardened, atomic restore so a recovery can't leave the system half-restored.

## Security & supply chain

- **Sustained security hardening.** A dedicated pre-launch hardening programme
  tightened authentication (per-account and per-IP login rate limiting, TOTP
  replay protection), added CSRF protection, enforced API-key domain scoping,
  bounded inbound-message resource use, and moved secret hashing to Argon2id.
- **Signed releases (Ed25519).** Every release binary and release manifest is
  signed with an offline Ed25519 key whose public half is compiled into the
  product, and verified in-process before any self-update — defence against a
  compromised download origin. Releases also ship an SPDX SBOM and keyless cosign
  signatures for the binary and every container image.

## Licensing

- **Offline licence verification** for Pro and Enterprise entitlements, so a
  licensed install keeps working through transient network or provider issues.

---

Looking for the earliest detailed notes? See
[v0.1.0](/release-notes/v010/) and [v0.1.1](/release-notes/v011/). For
everything in between and since, the
[GitHub Releases](https://github.com/Veltara-Works/vectis/releases) page carries
the complete per-version changelog.
