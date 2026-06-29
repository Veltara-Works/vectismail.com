// /api/unsubscribe?token=…
//   GET  — the human-clickable link in an email footer. Flips the subscriber to
//          `unsubscribed` and redirects to a branded confirmation page.
//   POST — RFC 8058 one-click (List-Unsubscribe-Post: List-Unsubscribe=One-Click).
//          The mail client POSTs here with the token in the query string;
//          we unsubscribe and return 204 with no body.
//
// We keep the row (status='unsubscribed') as a suppression record rather than
// deleting it, so a future broadcast never re-mails an opt-out.
//
// NOTE: emitting the List-Unsubscribe / List-Unsubscribe-Post headers on
// broadcasts needs the Vectis send API to allow those headers (currently it
// permits X-* only). That header-allowlist change is the Phase-B dependency
// for one-click unsubscribe; the endpoint itself is ready now.

interface Env {
  NEWSLETTER_DB: D1Database;
}

const SITE = "https://vectismail.com";

async function unsubscribe(db: D1Database, token: string): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE subscribers
       SET status = 'unsubscribed', unsubscribed_at = ?
       WHERE token = ? AND status != 'unsubscribed'`
    )
    .bind(new Date().toISOString(), token)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

function notice(title: string, body: string): Response {
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
  const token = new URL(ctx.request.url).searchParams.get("token") || "";
  if (!ctx.env.NEWSLETTER_DB || !token) {
    return notice("Invalid link", "This unsubscribe link is missing or malformed.");
  }
  try {
    await unsubscribe(ctx.env.NEWSLETTER_DB, token);
  } catch (e) {
    console.error("newsletter unsubscribe (GET) failed", String(e));
    return notice("Something went wrong", "Please try again in a moment.");
  }
  // Redirect whether or not a row changed — clicking again is harmless and the
  // user should always see the "you're unsubscribed" confirmation.
  return Response.redirect(`${SITE}/newsletter/unsubscribed/`, 302);
};

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const token = new URL(ctx.request.url).searchParams.get("token") || "";
  if (ctx.env.NEWSLETTER_DB && token) {
    try {
      await unsubscribe(ctx.env.NEWSLETTER_DB, token);
    } catch (e) {
      console.error("newsletter unsubscribe (one-click) failed", String(e));
    }
  }
  // One-click clients don't render a body; always 204 so the action reads as done.
  return new Response(null, { status: 204 });
};
