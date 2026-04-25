---
title: Activating Pro
description: How to activate your Pro subscription on a Vectis install after purchasing through ValidonX.
---

This guide walks through activating Pro on an installed Vectis server. You
should have your Vectis Pro subscription details from
[ValidonX](https://validonx.com/checkout/vectis-pro) before starting.

## What activation does

By default, Vectis runs in **Starter (Free) mode** — up to 3 domains, up to
25 mailboxes per domain, and the full set of mail-platform features
(webmail, sending API, monitoring, backups). Pro features are gated until
the server is registered with ValidonX.

Activating Pro:

- Removes the 3-domain and 25-mailbox-per-domain caps (becomes unlimited).
- Unlocks the per-domain analytics dashboard.
- Unlocks OIDC SSO for the admin UI.
- Enables priority email support tickets.
- No mail downtime — features unlock immediately, no service restart.

## One subscription, many installs

Pro is billed at **$29 per tenant per month**, where a tenant is your
organisation's account on ValidonX. A single subscription authorises
**all Vectis installs operated by your organisation** — production,
staging, multi-region, branch deployments. You activate each Vectis
install by pasting the same four credentials on its License page; the
ValidonX `service_key` and `tenant_id` are shared across them.

If your deployment shape is "one Vectis server", the subscription
covers it as expected. If you run multiple Vectis installs under the
same business, you still only pay one subscription. Per-install
license scoping (so a single compromised install can be revoked
without impacting the rest) is on the v0.1.x roadmap.

## Step 1 — Get your subscription details

After completing checkout on ValidonX, your subscription dashboard will
display the four fields Vectis needs:

- **Subscription ID** — identifies your active Pro plan.
- **Tenant ID** — your customer-account identifier in ValidonX. One
  tenant covers every Vectis install operated by your organisation.
- **Service Key** — a per-tenant authentication key. Treat as a secret;
  it authenticates all your organisation's Vectis installs to
  ValidonX. (Per-install scoping is on the v0.1.x roadmap.)
- **Server ID** *(optional)* — a unique label for this specific
  install, used in usage telemetry to distinguish multiple Vectis
  installs running under the same subscription. If left blank, Vectis
  defaults to the configured hostname.

The base URL defaults to `https://api.validonx.com` and only needs to be
overridden if Veltara Works has issued you a different endpoint.

## Step 2 — Open the License page

In your Vectis admin UI:

1. Sign in as a **super admin** account (the one created during install).
2. From the left-hand sidebar, click **License**. The page is only visible
   to super admins.
3. The current state will read **FREE — Unconfigured**.

## Step 3 — Activate

1. Click **Activate Pro / Enterprise**.
2. Paste each of the four fields from your ValidonX dashboard into the
   corresponding input.
3. Click **Activate**.

The server validates the credentials against ValidonX in real time. If the
subscription is active and the credentials match, the page reloads showing
**PRO — active**, the masked subscription ID, the cached-entitlement
expiry, and the days of grace remaining if ValidonX becomes unreachable.

If activation fails, the response body explains why — common cases are
typo'd service key, an expired or cancelled subscription on the ValidonX
side, or temporary ValidonX unreachability. Vectis itself remains in
Starter mode until activation succeeds.

## Step 4 — Verify the gates flipped

A quick sanity check after activation:

- The **Domains** page no longer caps creation at 3.
- The **/api/v1/analytics** endpoint returns data instead of `403`.
- The OIDC login redirect flows to your provider rather than returning
  an upgrade-required error.

The cached entitlements refresh automatically as the orchestrator polls
ValidonX. The first refresh after activation is immediate; subsequent
checks happen periodically and on demand via the **Re-validate now**
button on the License page.

## Offline grace period

Vectis caches entitlements in Postgres. If ValidonX becomes unreachable
(network outage, ValidonX maintenance) Vectis keeps Pro features running
for up to **30 days** while it retries refreshes in the background. Past
that window without a successful refresh, Pro endpoints return
`LICENSE_EXPIRED` until the server can reach ValidonX again.

This means a Vectis install can survive extended ValidonX outages without
disrupting mail delivery (which is never gated) or Pro features (which
keep working through the grace window).

## Cancelling or moving to a different subscription

To remove an active subscription:

1. Open the **License** page.
2. Click **Remove license**.
3. Confirm in the dialog.

The server reverts immediately to Starter mode. **Existing data is
preserved** — domains, mailboxes, and aliases beyond the Free-tier caps
remain in place and operational. Only the *creation* of new resources
past the Starter limits is blocked from that point.

Because one tenant subscription covers all your Vectis installs, you
do **not** need to remove the licence to bring up a second install —
just paste the same four credentials on the new server's License page
and it activates as Pro under the same subscription. To fully retire
an install, run **Remove license** on the old server before
decommissioning it.

## Activating via secrets.yaml (advanced / scripted)

For fully automated deploys you can pre-populate ValidonX credentials in
`/etc/vectis/secrets.yaml`:

```yaml
validonx:
  base_url: https://api.validonx.com
  service_key: ""
  tenant_id: ""
  subscription_id: ""
  server_id: ""
  license_key: ""   # v0.1.0-beta1 only — see "About license_key" below
```

When the API container starts, it reads the validonx_config DB row first
(set by the License page), falling through to `secrets.yaml`. Either
source provides the credentials; the DB takes precedence when both are
populated.

For most deployments the admin UI flow is the recommended path.

## About `license_key` (v0.1.0-beta1 only)

The `license_key` field listed under `secrets.yaml` is a transitional
requirement during the **v0.1.0-beta1** window only. ValidonX issues
license keys as separate cryptographic strings under each subscription;
during beta1 the Vectis client calls ValidonX's `/api/v1/integration/
entitlements/check` endpoint, which requires `license_key` on the wire.
Operators activating beta1 paste the value into `secrets.yaml` (it is
**not** exposed via the admin UI).

When **v0.1.0 stable** ships, ValidonX's dedicated `/v1/licensing/resolve`
endpoint resolves `license_key` server-side from the existing
`subscription_id` plus tenant context. At that point:

- The `license_key` field disappears from `secrets.yaml` and the
  `ValidonXSecrets` struct.
- The path-1 adapter at `internal/validonx/path1.go` is deleted.
- Existing v0.1.0-beta1 installs upgrade through the orchestrator UI
  with no operator action — the license_key value already in their
  `secrets.yaml` is simply ignored after the upgrade.

This is documented as `§11` in [`docs/notes/deferred-items.md`](https://github.com/Veltara-Works/vectis/blob/main/docs/notes/deferred-items.md)
in the Vectis repo. If you're activating Pro on or after v0.1.0 stable,
ignore the `license_key` field — your ValidonX subscription details
won't include one.
