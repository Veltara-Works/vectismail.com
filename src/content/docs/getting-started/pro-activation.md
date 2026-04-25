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

## Step 1 — Get your subscription details

After completing checkout on ValidonX, your subscription dashboard will
display the four fields Vectis needs:

- **Subscription ID** — identifies your active Pro plan.
- **Tenant ID** — your customer-account identifier in ValidonX.
- **Service Key** — a per-install authentication key. Treat as a secret;
  it grants this Vectis server the ability to identify itself to ValidonX.
- **Server ID** *(optional)* — a unique label for this specific server.
  If left blank, Vectis defaults to the configured hostname.

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

To move a subscription to a different server, run **Remove license** on
the old server first (so ValidonX can reissue the seat) then activate
on the new one.

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
```

When the API container starts, it reads the validonx_config DB row first
(set by the License page), falling through to `secrets.yaml`. Either
source provides the credentials; the DB takes precedence when both are
populated.

For most deployments the admin UI flow is the recommended path.
