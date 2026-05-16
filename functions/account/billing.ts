// GET /account/billing?tenant=<id>
// Cloudflare Pages Function — marketing-site billing-portal proxy.
//
// Customers receive a "Manage subscription" CTA in their Vectis Mail Pro
// welcome email. The CTA points at this route. We accept the customer's
// ValidonX tenant_id as a query param, ask ValidonX to mint a Stripe
// Billing Portal session for that tenant, and 302-redirect the customer to
// Stripe. The customer never sees `app.validonx.com` in their URL bar —
// only `vectismail.com` and `billing.stripe.com`.
//
// Env vars (set in Cloudflare Pages project settings):
//   VALIDONX_API_KEY  — partner-scoped X-API-Key authorising portal mints
//                       across customer tenants (NOT a per-install service_key)
//   VALIDONX_API_BASE — e.g. https://app.validonx.com (no trailing slash)
//
// Failure modes are rendered inline as branded HTML pages (not JSON) since
// the user lands here from an email click.

interface Env {
  VALIDONX_API_KEY: string;
  VALIDONX_API_BASE: string;
}

const RETURN_URL = "https://vectismail.com/account/billing/done";
const SUPPORT_MAILTO = "mailto:support@vectismail.com";

// ValidonX `tenants.id` is a UUID (confirmed 2026-05-16). ULID kept as a
// secondary acceptable shape so we don't have to redeploy if they ever
// switch identifier scheme. Real validation is at Vx's endpoint — this is
// just a cheap shape check to bounce obvious tampering before a network hop.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
function isValidTenant(s: string): boolean {
  return UUID_RE.test(s) || ULID_RE.test(s);
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const tenant = (url.searchParams.get("tenant") ?? "").trim();

  if (!tenant) {
    return errorPage(
      400,
      "Missing tenant identifier",
      "This page needs to be reached from the link in your Vectis Mail welcome email — that link includes the tenant identifier required to load your billing portal.",
      "If you've lost the email or the link looks broken, contact us and we'll send a fresh portal link.",
    );
  }
  if (!isValidTenant(tenant)) {
    return errorPage(
      400,
      "Invalid tenant identifier",
      "The tenant identifier in this link doesn't look right. The link from your welcome email may have been truncated or modified by an email client.",
      "Try opening the original welcome email and clicking the link again, or contact us for a fresh link.",
    );
  }

  if (!ctx.env.VALIDONX_API_KEY || !ctx.env.VALIDONX_API_BASE) {
    console.error("billing portal proxy misconfigured: missing env vars");
    return errorPage(
      500,
      "Billing portal temporarily unavailable",
      "We're unable to load your billing portal right now due to a configuration issue on our side.",
      "Please contact us — we'll resolve this and send you a working portal link.",
    );
  }

  const apiBase = ctx.env.VALIDONX_API_BASE.replace(/\/+$/, "");
  const endpoint = `${apiBase}/api/v1/integration/billing/portal-session`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ctx.env.VALIDONX_API_KEY,
      },
      body: JSON.stringify({
        tenant_id: tenant,
        return_url: RETURN_URL,
      }),
    });
  } catch (err) {
    console.error("validonx portal-session network error", err);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "We couldn't reach our billing system right now. This is usually a transient issue.",
      "Please try clicking the link from your welcome email again in a few minutes, or contact us if it keeps failing.",
    );
  }

  // Error contract per Vx 2026-05-16:
  //   404 LICENSING.TENANT_NOT_FOUND   — body tenant_id doesn't resolve
  //   409 BILLING.PORTAL_SESSION_NO_STRIPE_CUSTOMER — pre-live or free
  //   422 VALIDATION.FAILED            — bad request shape (OUR bug)
  //   401 AUTH.INVALID_API_KEY         — partner key revoked
  //   403 AUTH.SCOPE_INSUFFICIENT      — key scope wrong
  //   other 5xx                        — transient / unknown
  if (res.status === 404) {
    const detail = await res.text().catch(() => "");
    console.error("validonx portal-session tenant not found", detail);
    return errorPage(
      404,
      "Subscription not found",
      "We couldn't find a subscription for this account. The link from your welcome email may be out of date, or the tenant identifier may be incorrect.",
      "Please contact us with the email address you signed up with and we'll get you a fresh portal link.",
    );
  }

  if (res.status === 409) {
    const detail = await res.text().catch(() => "");
    console.error("validonx portal-session no stripe customer", detail);
    return errorPage(
      409,
      "Billing portal not yet available for this account",
      "Your account doesn't have a billing portal set up yet. This usually means your subscription was created before our self-service billing went live.",
      "Please contact us and we'll handle any subscription changes for you directly.",
    );
  }

  if (res.status === 401 || res.status === 403) {
    // Partner key revoked or scope insufficient. This is a Vectis-side
    // operational issue (key rotation / scope misconfiguration), not a
    // customer-facing one — show generic "temporarily unavailable" and
    // log loudly so we know to rotate.
    const detail = await res.text().catch(() => "");
    console.error("validonx portal-session AUTH FAILURE — key needs rotation", res.status, detail);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "We couldn't load your billing portal right now due to a temporary issue on our side.",
      "Please try clicking the link from your welcome email again in a few minutes, or contact us if it keeps failing.",
    );
  }

  if (res.status === 422) {
    // Vx 422 = malformed request body. Means OUR Pages Function is sending
    // a shape they don't accept — code bug, not a customer-facing issue.
    const detail = await res.text().catch(() => "");
    console.error("validonx portal-session 422 VALIDATION.FAILED — request shape bug", detail);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "We couldn't load your billing portal right now due to a temporary issue on our side.",
      "Please try again in a few minutes, or contact us if it keeps failing.",
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("validonx portal-session failed", res.status, detail);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "We couldn't load your billing portal right now.",
      "Please try clicking the link from your welcome email again in a few minutes, or contact us if it keeps failing.",
    );
  }

  let body: { data?: { url?: string } };
  try {
    body = await res.json();
  } catch (err) {
    console.error("validonx portal-session bad json", err);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "We received an unexpected response from our billing system.",
      "Please contact us — we'll send you a working portal link directly.",
    );
  }

  const portalUrl = body.data?.url;
  if (!portalUrl || typeof portalUrl !== "string") {
    console.error("validonx portal-session missing url", body);
    return errorPage(
      502,
      "Billing portal temporarily unavailable",
      "Our billing system returned a response we couldn't use.",
      "Please contact us — we'll send you a working portal link directly.",
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: portalUrl,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
};

// Branded HTML error page — matches the marketing-site dark theme without
// pulling in the Starlight/Astro layout chain (this is a Worker, not a build
// step). Inline CSS only, no external assets except the logo.
function errorPage(
  status: number,
  heading: string,
  body: string,
  followUp: string,
): Response {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(heading)} — Vectis Mail</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    background: #0C0C0D;
    color: #E6E6E6;
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
  }
  header {
    padding: 1.5rem 2rem;
    border-bottom: 1px solid #1f1f22;
  }
  header img { height: 32px; display: block; }
  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.5rem;
  }
  .card {
    max-width: 560px;
    width: 100%;
    background: #141416;
    border: 1px solid #2a2a2e;
    border-radius: 12px;
    padding: 2.25rem 2rem;
  }
  h1 {
    font-size: 1.5rem;
    margin: 0 0 1rem;
    color: #ffffff;
    line-height: 1.3;
  }
  p { margin: 0 0 1rem; color: #c8c8cc; }
  p.followup { color: #9a9aa0; font-size: 0.95rem; margin-top: 1.5rem; }
  a.cta {
    display: inline-block;
    margin-top: 0.5rem;
    padding: 0.65rem 1.1rem;
    background: #2563EB;
    color: #fff;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 0.95rem;
  }
  a.cta:hover { background: #1d4ed8; }
  footer {
    padding: 1.5rem 2rem;
    border-top: 1px solid #1f1f22;
    color: #6a6a70;
    font-size: 0.85rem;
    text-align: center;
  }
  footer a { color: #9a9aa0; text-decoration: none; }
  footer a:hover { color: #c8c8cc; }
</style>
</head>
<body>
<header>
  <a href="https://vectismail.com/"><img src="/brand/logos/vectis-mail-logo-white.png" alt="Vectis Mail" /></a>
</header>
<main>
  <div class="card">
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(body)}</p>
    <p class="followup">${escapeHtml(followUp)}</p>
    <a class="cta" href="${SUPPORT_MAILTO}">Contact support</a>
  </div>
</main>
<footer>
  &copy; 2026 Vectis Mail · <a href="https://vectismail.com/">vectismail.com</a>
</footer>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
