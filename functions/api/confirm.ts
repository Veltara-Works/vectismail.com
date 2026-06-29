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
    // Look up the row first, then branch on status — this avoids relying on
    // UPDATE row-change counts (ambiguous across engines) AND keeps an
    // explicit opt-out sticky: an `unsubscribed` row must NOT be resurrected
    // by re-hitting an old confirm link (re-subscribing happens via the form,
    // which issues a fresh pending token).
    const row = await ctx.env.NEWSLETTER_DB
      .prepare("SELECT status FROM subscribers WHERE token = ?")
      .bind(token)
      .first<{ status: string }>();

    if (!row) {
      return notice(
        "Link expired",
        "This confirmation link is invalid or has expired. Try subscribing again from the site."
      );
    }

    if (row.status === "unsubscribed") {
      // Don't silently re-add someone who opted out.
      return notice(
        "Link no longer valid",
        "This address was unsubscribed. If you'd like product updates again, re-subscribe from the site."
      );
    }

    if (row.status === "pending") {
      await ctx.env.NEWSLETTER_DB
        .prepare(
          "UPDATE subscribers SET status = 'confirmed', confirmed_at = ? WHERE token = ? AND status = 'pending'"
        )
        .bind(new Date().toISOString(), token)
        .run();
    }
    // status === 'confirmed' (already confirmed): fall through — idempotent.
  } catch (e) {
    console.error("newsletter confirm failed", String(e));
    return notice("Something went wrong", "Please try again in a moment.");
  }

  return Response.redirect(`${SITE}/newsletter/confirmed/`, 302);
};
