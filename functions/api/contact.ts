// POST /api/contact
// Cloudflare Pages Function — forwards the marketing-site contact form to the
// Vectis Mail send API, dogfooding our own product. Secret VECTIS_API_TOKEN
// must be set in the Pages project environment.

interface Env {
  VECTIS_API_TOKEN: string;
}

interface ContactPayload {
  department: string;
  name: string;
  email: string;
  message: string;
}

const DEPARTMENT_TO: Record<string, string> = {
  general: "hello@vectismail.com",
  sales: "sales@vectismail.com",
  support: "support@vectismail.com",
};

const DEPARTMENT_LABEL: Record<string, string> = {
  general: "General Enquiries",
  sales: "Enterprise Sales",
  support: "Technical Support",
};

const FROM_EMAIL = "contact@vectismail.com";
const FROM_NAME = "Vectis Mail Contact Form";
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

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.VECTIS_API_TOKEN) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let payload: ContactPayload;
  try {
    payload = (await ctx.request.json()) as ContactPayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const department = String(payload.department ?? "").trim().toLowerCase();
  const name = String(payload.name ?? "").trim();
  const email = String(payload.email ?? "").trim();
  const message = String(payload.message ?? "").trim();

  if (!DEPARTMENT_TO[department]) return json({ error: "Invalid department" }, 400);
  if (!name || name.length > 200) return json({ error: "Invalid name" }, 400);
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);
  if (!message || message.length > 2000) return json({ error: "Invalid message" }, 400);

  const to = DEPARTMENT_TO[department];
  const label = DEPARTMENT_LABEL[department];
  const subject = `[${label}] Contact from ${name}`;

  const textBody =
    `New message from the vectismail.com contact form.\n\n` +
    `Department: ${label}\n` +
    `Name:       ${name}\n` +
    `Email:      ${email}\n` +
    `\n${message}\n`;

  const htmlBody =
    `<p>New message from the vectismail.com contact form.</p>` +
    `<table cellpadding="4" style="border-collapse:collapse;">` +
    `<tr><td><strong>Department</strong></td><td>${escapeHtml(label)}</td></tr>` +
    `<tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>` +
    `<tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>` +
    `</table>` +
    `<pre style="white-space:pre-wrap;font-family:inherit;margin-top:1rem;">${escapeHtml(message)}</pre>`;

  const sendRes = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.VECTIS_API_TOKEN}`,
    },
    body: JSON.stringify({
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      reply_to: { email, name },
      subject,
      text_body: textBody,
      html_body: htmlBody,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    console.error("vectis send failed", sendRes.status, detail);
    return json({ error: "Unable to send message" }, 502);
  }

  return json({ ok: true }, 200);
};
