// POST /api/subscribe
// Cloudflare Pages Function — product-updates newsletter signup (double opt-in).
//
// Flow: a signup writes/refreshes a `pending` row in D1 (NEWSLETTER_DB) and
// sends a confirmation email through the Vectis Mail send API (we dogfood our
// own product). The address is only added to the list once the recipient
// clicks the confirm link (-> /api/confirm). Unsubscribe is /api/unsubscribe.
//
// Bindings required (Pages project env):
//   VECTIS_API_TOKEN  — domain-scoped send key for vectismail.com
//   NEWSLETTER_DB     — D1 database (schema: migrations/0001_subscribers.sql)

interface Env {
  VECTIS_API_TOKEN: string;
  NEWSLETTER_DB: D1Database;
}

interface SubscribePayload {
  email?: string;
  // Honeypot: bots fill hidden fields; humans don't. Reject if present.
  company?: string;
  // Where on the site the signup came from (e.g. "footer", "docs:guides/…").
  source?: string;
}

interface SubscriberRow {
  email: string;
  status: string;
  created_at: string;
}

const FROM_EMAIL = "contact@vectismail.com";
const FROM_NAME = "Vectis Mail";
const SEND_ENDPOINT = "https://mail.vectismail.com/api/v1/send";
const SITE = "https://vectismail.com";

// Don't re-send a confirmation to a still-pending address more often than this
// — limits confirm-bombing a third party's inbox via repeated submits.
const RESEND_THROTTLE_MS = 10 * 60 * 1000;

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

async function sendConfirmEmail(token: string, email: string, apiToken: string): Promise<boolean> {
  const confirmUrl = `${SITE}/api/confirm?token=${encodeURIComponent(token)}`;
  const subject = "Confirm your Vectis Mail subscription";
  const textBody =
    `Thanks for signing up for Vectis Mail product updates.\n\n` +
    `Please confirm your subscription by opening this link:\n${confirmUrl}\n\n` +
    `If you didn't request this, just ignore this email — you won't be added ` +
    `to the list unless you confirm.\n\n— Vectis Mail\n`;
  const htmlBody =
    `<p>Thanks for signing up for <strong>Vectis Mail</strong> product updates.</p>` +
    `<p><a href="${escapeHtml(confirmUrl)}">Confirm your subscription</a></p>` +
    `<p style="color:#666;font-size:13px">Or paste this link into your browser:<br>` +
    `${escapeHtml(confirmUrl)}</p>` +
    `<p style="color:#666;font-size:13px">If you didn't request this, just ignore this email — ` +
    `you won't be added to the list unless you confirm.</p>` +
    `<p style="color:#666;font-size:13px">— Vectis Mail</p>`;

  const res = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email }],
      reply_to: { email: FROM_EMAIL },
      subject,
      text_body: textBody,
      html_body: htmlBody,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("vectis confirm-email send failed", res.status, detail);
  }
  return res.ok;
}

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.VECTIS_API_TOKEN || !ctx.env.NEWSLETTER_DB) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let payload: SubscribePayload;
  try {
    payload = (await ctx.request.json()) as SubscribePayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Honeypot: a filled "company" field means a bot. Accept silently (200) so the
  // bot sees success and moves on, but do nothing.
  if (field(payload.company, 200)) return json({ ok: true }, 200);

  const email = field(payload.email, 254).toLowerCase();
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);
  const source = field(payload.source, 80) || "footer";

  const db = ctx.env.NEWSLETTER_DB;

  let existing: SubscriberRow | null;
  try {
    existing = await db
      .prepare("SELECT email, status, created_at FROM subscribers WHERE email = ?")
      .bind(email)
      .first<SubscriberRow>();
  } catch (e) {
    console.error("newsletter D1 read failed", String(e));
    return json({ error: "Unable to subscribe" }, 502);
  }

  // Already confirmed: nothing to do. Return ok without leaking membership or
  // re-sending anything.
  if (existing && existing.status === "confirmed") {
    return json({ ok: true }, 200);
  }

  // Still pending and issued recently enough: swallow the repeat without
  // emailing again (anti-bombing). Return ok so the UI shows the same message.
  if (existing && existing.status === "pending") {
    const age = Date.now() - Date.parse(existing.created_at);
    if (Number.isFinite(age) && age >= 0 && age < RESEND_THROTTLE_MS) {
      return json({ ok: true }, 200);
    }
  }

  const token = crypto.randomUUID();

  // Send first; only persist the (re)issued token once the email is away, so a
  // pending row always corresponds to a confirmation that actually went out.
  const sent = await sendConfirmEmail(token, email, ctx.env.VECTIS_API_TOKEN);
  if (!sent) return json({ error: "Unable to subscribe" }, 502);

  const now = new Date().toISOString();
  try {
    // Upsert as pending with the fresh token. created_at doubles as the
    // last-issued timestamp that the throttle above reads.
    await db
      .prepare(
        `INSERT INTO subscribers (email, status, token, source, created_at)
         VALUES (?, 'pending', ?, ?, ?)
         ON CONFLICT(email) DO UPDATE SET
           status = 'pending',
           token = excluded.token,
           source = excluded.source,
           created_at = excluded.created_at,
           confirmed_at = NULL,
           unsubscribed_at = NULL`
      )
      .bind(email, token, source, now)
      .run();
  } catch (e) {
    console.error("newsletter D1 upsert failed", String(e));
    // The confirm email already went out; surface a soft failure so the user
    // can retry (the retry re-sends + re-upserts).
    return json({ error: "Unable to subscribe" }, 502);
  }

  return json({ ok: true }, 200);
};
