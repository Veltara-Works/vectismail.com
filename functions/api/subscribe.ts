// POST /api/subscribe
// Cloudflare Pages Function — receives a product-updates email signup (the
// footer newsletter capture) and forwards it to an internal inbox via the
// Vectis Mail send API, dogfooding our own product. Secret VECTIS_API_TOKEN
// must be set in the Pages project environment (shared with capture/contact).
//
// NOTE (MVP): signups land in an inbox, not a managed subscriber list. That's
// deliberate for low-volume pre-launch; a real list / double opt-in / one-click
// unsubscribe is a follow-up. The on-site copy promises only "occasional
// product updates", so we are not over-claiming a fixed cadence.

interface Env {
  VECTIS_API_TOKEN: string;
}

interface SubscribePayload {
  email?: string;
  // Honeypot: bots fill hidden fields; humans don't. Reject if present.
  company?: string;
  // Where on the site the signup came from (e.g. "footer"). Optional, for context.
  source?: string;
}

// Product-updates signups land here. Adjust if a dedicated list address is added.
const TO_EMAIL = "hello@vectismail.com";
const FROM_EMAIL = "contact@vectismail.com";
const FROM_NAME = "Vectis Mail Newsletter";
const SEND_ENDPOINT = "https://mail.vectismail.com/api/v1/send";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "https://vectismail.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra },
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

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254;
}

function field(v: unknown, max = 120): string {
  return String(v ?? "").trim().slice(0, max);
}

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.VECTIS_API_TOKEN) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let payload: SubscribePayload;
  try {
    payload = (await ctx.request.json()) as SubscribePayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Honeypot: a filled "company" field means a bot. Accept silently (200) so the
  // bot sees success and moves on, but send nothing.
  if (field(payload.company, 200)) return json({ ok: true }, 200);

  const email = field(payload.email, 254);
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);

  const source = field(payload.source, 60) || "footer";

  const subject = `[Subscribe] product-updates signup`;
  const textBody =
    `New product-updates signup from vectismail.com.\n\n` +
    `Email:  ${email}\n` +
    `Source: ${source}\n`;
  const htmlBody =
    `<p>New product-updates signup from vectismail.com.</p>` +
    `<table cellpadding="4" style="border-collapse:collapse;">` +
    `<tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>` +
    `<tr><td><strong>Source</strong></td><td>${escapeHtml(source)}</td></tr>` +
    `</table>`;

  const sendRes = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.VECTIS_API_TOKEN}`,
    },
    body: JSON.stringify({
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: TO_EMAIL }],
      reply_to: { email },
      subject,
      text_body: textBody,
      html_body: htmlBody,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    console.error("vectis subscribe send failed", sendRes.status, detail);
    return json({ error: "Unable to subscribe" }, 502);
  }

  return json({ ok: true }, 200);
};
