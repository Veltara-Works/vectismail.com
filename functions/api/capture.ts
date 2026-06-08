// POST /api/capture
// Cloudflare Pages Function — receives the segmented "Talk to us" capture form
// (the WTP instrument behind the pricing-page capture line) and forwards a
// structured summary to sales@vectismail.com via the Vectis Mail send API,
// dogfooding our own product. Secret VECTIS_API_TOKEN must be set in the Pages
// project environment (shared with the contact form).

interface Env {
  VECTIS_API_TOKEN: string;
}

interface CapturePayload {
  segment?: string;
  name?: string;
  email?: string;
  company?: string;
  // agency lanes
  clients?: string;
  domainsPerClient?: string;
  mailboxesPerClient?: string;
  // enterprise lane
  seats?: string;
  assurance?: unknown; // string[] of needs
  // both
  currentSpend?: string;
  budget?: string;
  message?: string;
}

const SEGMENT_LABEL: Record<string, string> = {
  "agency-managed": "Agency — managed (no per-client logins)",
  "agency-isolation": "Agency — needs client isolation / white-label",
  enterprise: "Enterprise — assurance (SAML / SLA / compliance)",
  other: "Other",
};

const ASSURANCE_LABEL: Record<string, string> = {
  saml: "SAML SSO",
  scim: "SCIM provisioning",
  sla: "SLA-backed support",
  compliance: "Compliance / DSAR",
  audit: "Audit-evidence export",
  residency: "Data residency",
};

// Where each segment's lead lands. Agency + enterprise + other all go to sales
// (the capture form is a sales/WTP instrument, not general support).
const TO_EMAIL = "sales@vectismail.com";

const FROM_EMAIL = "contact@vectismail.com";
const FROM_NAME = "Vectis Mail Capture Form";
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

// Clamp an arbitrary string field to a safe length, trimmed.
function field(v: unknown, max = 120): string {
  return String(v ?? "").trim().slice(0, max);
}

export const onRequestOptions: PagesFunction<Env> = () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  if (!ctx.env.VECTIS_API_TOKEN) {
    return json({ error: "Server misconfigured" }, 500);
  }

  let payload: CapturePayload;
  try {
    payload = (await ctx.request.json()) as CapturePayload;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const segment = field(payload.segment, 40).toLowerCase();
  const name = field(payload.name, 200);
  const email = field(payload.email, 254);

  // Required across every lane.
  if (!SEGMENT_LABEL[segment]) return json({ error: "Invalid segment" }, 400);
  if (!name) return json({ error: "Invalid name" }, 400);
  if (!isValidEmail(email)) return json({ error: "Invalid email" }, 400);

  const company = field(payload.company, 200);
  const message = field(payload.message, 2000);

  // Capacity / WTP fields — all optional, kept short.
  const rows: Array<[string, string]> = [];
  const add = (label: string, val: string) => {
    if (val) rows.push([label, val]);
  };

  add("Segment", SEGMENT_LABEL[segment]);
  add("Name", name);
  add("Email", email);
  add("Company", company);

  if (segment === "agency-managed" || segment === "agency-isolation") {
    add("Clients", field(payload.clients, 40));
    add("Domains per client", field(payload.domainsPerClient, 40));
    add("Mailboxes per client", field(payload.mailboxesPerClient, 40));
  }

  if (segment === "enterprise") {
    add("Mailboxes / seats", field(payload.seats, 40));
    const assurance = Array.isArray(payload.assurance)
      ? (payload.assurance as unknown[])
          .map((a) => ASSURANCE_LABEL[field(a, 30).toLowerCase()] || field(a, 30))
          .filter(Boolean)
          .slice(0, 10)
      : [];
    add("Assurance needs", assurance.join(", "));
  }

  add("Current email spend / mo", field(payload.currentSpend, 60));
  add("Budget / mo", field(payload.budget, 60));

  const label = SEGMENT_LABEL[segment];
  const subject = `[Capture: ${label}] ${company || name}`;

  const textBody =
    `New capture-form submission from vectismail.com (Talk to us).\n\n` +
    rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
    (message ? `\n\nMessage:\n${message}\n` : "\n");

  const htmlBody =
    `<p>New capture-form submission from vectismail.com (Talk to us).</p>` +
    `<table cellpadding="4" style="border-collapse:collapse;">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="vertical-align:top;"><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(
            v
          )}</td></tr>`
      )
      .join("") +
    `</table>` +
    (message
      ? `<p style="margin-top:1rem;"><strong>Message</strong></p><pre style="white-space:pre-wrap;font-family:inherit;">${escapeHtml(
          message
        )}</pre>`
      : "");

  const sendRes = await fetch(SEND_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.env.VECTIS_API_TOKEN}`,
    },
    body: JSON.stringify({
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: TO_EMAIL }],
      reply_to: { email, name },
      subject,
      text_body: textBody,
      html_body: htmlBody,
    }),
  });

  if (!sendRes.ok) {
    const detail = await sendRes.text().catch(() => "");
    console.error("vectis capture send failed", sendRes.status, detail);
    return json({ error: "Unable to send" }, 502);
  }

  return json({ ok: true }, 200);
};
