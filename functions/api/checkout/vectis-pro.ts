// POST /api/checkout/vectis-pro
// Cloudflare Pages Function — marketing-site "Buy Pro" proxy.
//
// Customer journey #2 (direct purchase from marketing site):
//   /upgrade form → POST here → ValidonX /api/v1/checkout/vectis-pro →
//   302-redirect to Stripe-hosted Checkout → on success, Stripe redirects
//   the customer to /upgrade/success?session=cs_live_... (assuming Vx
//   honours the success_url we pass; if not, Vx's default kicks in).
//
// Upstream contract observed via probe 2026-05-19 14:55 AEST:
//   - Required body fields: owner_email, owner_name
//   - 201 Created → { data: { checkout_url, session_id }, meta: {...} }
//   - 422 Unprocessable Content with Laravel `{ message, errors: { field: [...] } }`
//     when validation fails
//   - 6/min rate limit per IP, exposed via X-RateLimit-* headers
//   - No CORS Access-Control-Allow-Origin → browsers must call this proxy
//     instead of the upstream directly
//   - Whether success_url / cancel_url / allow_promotion_codes are honoured
//     by the upstream is being confirmed with Vx; we pass them anyway so
//     they take effect as soon as that confirmation lands.
//
// Env vars (set in Cloudflare Pages project settings):
//   VALIDONX_API_BASE — e.g. https://validonx.com (no trailing slash)
//
// Note: this endpoint is ANONYMOUS upstream — no X-API-Key required. It's
// rate-limited by Vx at 6/min per IP. We could front it with CF Turnstile
// if abuse becomes a problem post-launch, but launch-day complexity is
// deliberately minimised here.

interface Env {
  VALIDONX_API_BASE: string;
}

const SUCCESS_URL = "https://vectismail.com/upgrade/success/?session={CHECKOUT_SESSION_ID}";
const CANCEL_URL = "https://vectismail.com/upgrade/cancelled/";
const FAILURE_REDIRECT = "/upgrade/?error="; // returns to form with error query

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function redirectTo(location: string, status = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  let owner_email = "";
  let owner_name = "";

  // Accept either application/x-www-form-urlencoded (default browser POST)
  // or application/json (AJAX caller / smoke harness).
  const contentType = (ctx.request.headers.get("content-type") ?? "").toLowerCase();
  try {
    if (contentType.startsWith("application/json")) {
      const body = await ctx.request.json<{ owner_email?: string; owner_name?: string }>();
      owner_email = (body.owner_email ?? "").trim();
      owner_name = (body.owner_name ?? "").trim();
    } else {
      const form = await ctx.request.formData();
      owner_email = String(form.get("owner_email") ?? "").trim();
      owner_name = String(form.get("owner_name") ?? "").trim();
    }
  } catch (err) {
    console.error("checkout proxy: malformed body", err);
    return redirectTo(`${FAILURE_REDIRECT}malformed-body`);
  }

  if (!owner_email || !isValidEmail(owner_email)) {
    return redirectTo(`${FAILURE_REDIRECT}invalid-email`);
  }
  if (!owner_name || owner_name.length < 1 || owner_name.length > 200) {
    return redirectTo(`${FAILURE_REDIRECT}invalid-name`);
  }

  if (!ctx.env.VALIDONX_API_BASE) {
    console.error("checkout proxy: VALIDONX_API_BASE not configured");
    return errorPage(
      "Checkout temporarily unavailable",
      "We're unable to start the checkout flow right now due to a configuration issue on our side.",
      "Please try again in a few minutes, or contact us if it keeps failing.",
    );
  }

  const apiBase = ctx.env.VALIDONX_API_BASE.replace(/\/+$/, "");
  const endpoint = `${apiBase}/api/v1/checkout/vectis-pro`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        owner_email,
        owner_name,
        success_url: SUCCESS_URL,
        cancel_url: CANCEL_URL,
        allow_promotion_codes: true,
      }),
    });
  } catch (err) {
    console.error("checkout proxy: upstream network error", err);
    return errorPage(
      "Checkout temporarily unavailable",
      "We couldn't reach our billing system right now. This is usually a transient issue.",
      "Please try again in a few minutes, or contact us if it keeps failing.",
    );
  }

  if (res.status === 422) {
    // Upstream validation rejection. With our edge validation above, this
    // would usually mean a contract drift between Vx and us — log loudly.
    const detail = await res.text().catch(() => "");
    console.error("checkout proxy: upstream 422", detail);
    return redirectTo(`${FAILURE_REDIRECT}validation-failed`);
  }

  if (res.status === 429) {
    // Upstream rate-limited us. The customer didn't do anything wrong;
    // they should just try again. Show a polite "busy" page rather than
    // a 429 (which Cloudflare on this zone replaces with its own default).
    console.warn("checkout proxy: upstream 429 rate-limited");
    return errorPage(
      "Checkout briefly unavailable",
      "Our checkout system is handling a burst of requests right now. This usually clears within a minute.",
      "Please refresh and try again. If it keeps failing, contact us and we'll sort it out.",
    );
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("checkout proxy: upstream error", res.status, detail);
    return errorPage(
      "Checkout temporarily unavailable",
      "We couldn't start your checkout right now.",
      "Please try again in a few minutes, or contact us if it keeps failing.",
    );
  }

  let body: { data?: { checkout_url?: string; session_id?: string } };
  try {
    body = await res.json();
  } catch (err) {
    console.error("checkout proxy: upstream bad json", err);
    return errorPage(
      "Checkout temporarily unavailable",
      "We received an unexpected response from our billing system.",
      "Please try again, or contact us if it keeps failing.",
    );
  }

  const checkoutUrl = body.data?.checkout_url;
  if (!checkoutUrl || typeof checkoutUrl !== "string" || !checkoutUrl.startsWith("https://checkout.stripe.com/")) {
    console.error("checkout proxy: upstream missing/invalid checkout_url", body);
    return errorPage(
      "Checkout temporarily unavailable",
      "Our billing system returned a response we couldn't use.",
      "Please try again, or contact us if it keeps failing.",
    );
  }

  return redirectTo(checkoutUrl, 303); // 303 = "POST done, now GET this URL"
};

// Branded HTML error page. Identical visual treatment to functions/account/billing.ts
// so customer experience is consistent. Status clamped to 200 because the
// vectismail.com Cloudflare zone replaces 5xx Worker responses with its own
// default 15-byte text/plain page (root-caused 2026-05-16; see
// feedback_cloudflare_5xx_intercept memory).
const SUPPORT_MAILTO = "mailto:support@vectismail.com";

function errorPage(heading: string, body: string, followUp: string): Response {
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
  <a href="https://vectismail.com/"><img src="/brand/logos/vectis-mail-logo-white.webp" alt="Vectis Mail" width="181" height="34" /></a>
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
    status: 200,
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
