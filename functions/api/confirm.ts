// GET /api/confirm?token=…
// Double opt-in confirmation. The link in the confirmation email lands here.
// A matching token flips the subscriber to `confirmed` (idempotent) and
// redirects to a branded thank-you page. An unknown token shows a soft notice.

interface Env {
  NEWSLETTER_DB: D1Database;
}

const SITE = "https://vectismail.com";

function notice(title: string, body: string): Response {
  // 200 (not 5xx) so Cloudflare doesn't swap the body for its own error page.
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — Vectis Mail</title>
<style>body{font-family:system-ui,sans-serif;background:#0c0c0d;color:#e6edf3;
display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
.card{max-width:30rem;padding:2rem;text-align:center}a{color:#7aa2f7}</style>
</head><body><div class="card"><h1>${title}</h1><p>${body}</p>
<p><a href="${SITE}/">Back to vectismail.com</a></p></div></body></html>`;
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.NEWSLETTER_DB) {
    return notice("Something went wrong", "Please try again in a moment.");
  }

  const token = new URL(ctx.request.url).searchParams.get("token") || "";
  if (!token) {
    return notice("Invalid link", "This confirmation link is missing its token.");
  }

  try {
    // Idempotent: confirm on first click; a second click on the same link is a
    // no-op that still lands on the thank-you page. COALESCE keeps the original
    // confirmed_at if it was already set.
    const result = await ctx.env.NEWSLETTER_DB
      .prepare(
        `UPDATE subscribers
         SET status = 'confirmed',
             confirmed_at = COALESCE(confirmed_at, ?),
             unsubscribed_at = NULL
         WHERE token = ?`
      )
      .bind(new Date().toISOString(), token)
      .run();

    const changed = (result.meta?.changes ?? 0) > 0;
    if (!changed) {
      return notice(
        "Link expired",
        "This confirmation link is invalid or has expired. Try subscribing again from the site."
      );
    }
  } catch (e) {
    console.error("newsletter confirm failed", String(e));
    return notice("Something went wrong", "Please try again in a moment.");
  }

  return Response.redirect(`${SITE}/newsletter/confirmed/`, 302);
};
