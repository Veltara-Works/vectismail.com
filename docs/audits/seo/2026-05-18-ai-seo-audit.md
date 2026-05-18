# AI-SEO audit (AEO / GEO / LLMO) — 2026-05-18

**Scope:** Citation readiness for AI assistants — Google AI Overviews, ChatGPT, Perplexity, Claude, Gemini, Copilot.
**Companion to:** [`2026-05-18-site-wide-seo-audit.md`](2026-05-18-site-wide-seo-audit.md) (traditional SEO).
**Methodology:** Princeton GEO research framework (KDD 2024) + Anthropic/OpenAI crawler access verification + structural extractability checks against rendered HTML.

## Executive summary

**vectismail.com is in materially better AI-SEO shape than typical B2B SaaS sites.** The site demonstrates AEO/GEO/LLMO patterns most competitors don't: a comprehensive [llms.txt](https://vectismail.com/llms.txt), a 426-line [llms-full.txt](https://vectismail.com/llms-full.txt), a machine-readable [pricing.md](https://vectismail.com/pricing.md) with a cost-comparison table, `TechArticle` schema on all 7 guides, `HowTo` + `HowToStep` schema on the installation page, and best-in-class robots.txt that explicitly allows every major AI bot (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.).

The gaps are subtler — mostly **quality issues** rather than structural absence. The single biggest lever is **rewriting first-paragraphs on the home page and on the alternatives pages** to be direct, citation-extractable definition-statements rather than tagline-style openers.

**Top 5 priorities surfaced by this pass (in order):**

1. **Home page first paragraph** should be a 1-2 sentence value-prop, not a feature list. Right now it's "Deploy a production mail server in minutes. Declarative config, transactional sending API…" — that won't be cited. Compare /alternatives/sendgrid/'s lead: *"SendGrid prices per email. Vectis Mail prices per tenant. The math diverges fast."* — that's citation-grade.
2. **Alternative-page first paragraphs** lead with taglines ("Honest side-by-side, current as of May 2026") instead of one-sentence comparison statements. AI extracts the first paragraph as the citation preview — these should answer "what's the difference?" in one sentence.
3. **Add FAQ schema + content to the home** for the "vs Mailcow / vs SendGrid / vs Manual Postfix" cards (already flagged in the SEO audit, but the AEO impact is the bigger win — FAQPage is the single highest-citation surface).
4. **/pricing.md drift** — the file says "Last updated: 2026-05-12" but the live /pricing/ page shows "17 May 2026". AI agents reading pricing.md get stale data.
5. **Date hygiene on /guides/self-host-email-2026/** — that single guide is missing a visible `<time>` element. Every other audited page has one. Freshness signals are AI-relevant.

---

## What's already strong (skip these — already winning)

| Signal | State | Why it matters for AI |
|---|---|---|
| **robots.txt for AI bots** | Explicitly allows GPTBot, ChatGPT-User, OAI-SearchBot, ClaudeBot, anthropic-ai, PerplexityBot, Perplexity-User, Google-Extended, Bingbot, Applebot, Applebot-Extended | These platforms can crawl + cite. Most competitors block one or more. |
| **llms.txt** | Comprehensive — covers product summary, quick facts (14 containers, 60+ endpoints), pricing, docs links, guides, API reference, alt pages, contact | Direct AI context per [llmstxt.org](https://llmstxt.org). |
| **llms-full.txt** | 426 lines of full content inlined for LLM context windows | One-shot consumption by AI agents. |
| **pricing.md** | Machine-readable; lists tier features, license, cost comparison table vs SendGrid at 10k/100k/1M/5M+ volumes, what's NOT included | This is **best-in-class for AI agent-mediated buying**. Most competitors have nothing comparable. |
| **TechArticle schema** | All 7 guides | `TechArticle` is AI's preferred article schema for technical content. |
| **HowTo + HowToStep schema** | `/getting-started/installation/` | Direct extraction surface for "how do I install Vectis Mail" queries. |
| **Citation-bait stats** | "14 vs 25+ containers", "60+ endpoints", "6-phase atomic updates" surface across alt pages | +37% citation boost per Princeton GEO research. |
| **Entity disambiguation** | Vectis Mail (product) appears more frequently than Veltara Works (company) on every page; ValidonX (sibling platform) is mentioned only where contextually appropriate (licensing/billing/privacy) | AI gets the entity relationships right. |
| **Last-updated dates** | Visible `<time>` element on all marketing pages except `/guides/self-host-email-2026/` | Freshness is a major AI weighting factor. |
| **Static-built JSON-LD** | All schema is rendered inline by Astro at build time, not injected by JS | Curl/web_fetch can see it. So can every AI crawler. |

---

## Findings (net-new from traditional SEO audit)

### A1 — Home page lead reads as features list, not value-prop

**Current first content paragraph on `/`:**
> *"Deploy a production mail server in minutes. Declarative config, transactional sending API, inbound webhooks, and a full admin dashboard — all in one platform."*

AI extracts the first 100-150 words as the citation preview. This passage gets cited for "what is Vectis Mail?" but answers a different question — "what does Vectis Mail do?". Citation copy that triggers a click vs gets buried hinges on this distinction.

**Recommended:**
> *"Vectis Mail is a self-hosted email server you run on your own VPS. It packages Postfix, Dovecot, Rspamd, and Traefik with a Go-based control plane and React admin UI — managed through one YAML config file and a REST API. Same self-hosted philosophy as Mailcow, with a modern declarative surface. Free for up to 3 domains; $29/tenant/month unlocks unlimited domains, OIDC SSO, and per-domain analytics."*

Note this answers four implicit AI queries simultaneously: *what is Vectis Mail*, *what's it built on*, *how does it compare to Mailcow*, *what does it cost*.

**Effort:** 15 minutes. **AEO impact:** high — this paragraph gets extracted into every AI answer about Vectis Mail.

### A2 — Alternative-page leads are taglines, not direct answers

Current leads on alt pages:

| Page | Current lead | AEO problem |
|---|---|---|
| `/alternatives/` | *"Live, in-depth pages — each with a side-by-side table, the honest verdict, and a migration guide."* | Doesn't say what a Vectis Mail alternative IS or who Vectis competes with. AI can't cite this. |
| `/alternatives/mailcow/` | *"Honest side-by-side, current as of May 2026."* | Same problem. |
| `/alternatives/sendgrid/` | *"SendGrid prices per email. Vectis Mail prices per tenant. The math diverges fast."* | ✅ **This is the model.** Punchy, citation-grade, one-sentence comparison. |

**Recommended template:**
> First paragraph: *"<Competitor> is <one-sentence description>. Vectis Mail is <one-sentence positioning>. <One-sentence punchline of the difference>."*

The /alternatives/sendgrid/ lead is the template. /alternatives/mailcow/ should rewrite to something like:
> *"Mailcow is the de facto self-hosted email server from the past decade — Docker Compose, 25+ containers, web UI for everything. Vectis Mail is the same self-hosted philosophy with a modern surface — 14 containers, declarative YAML, REST API, atomic updates with automatic rollback."*

**Effort:** 30 minutes (5 pages × 5 min). **AEO impact:** high — citation rate on "Mailcow alternative" / "iRedMail alternative" / etc.

### A3 — /for/ persona pages lead with listicle openers

| Page | Current lead | Issue |
|---|---|---|
| `/for/agencies/` | *"Six things agencies running mail infrastructure consistently need. Each maps to a specific Vectis Mail capability."* | Engagement opener, not definition. AI extracts: "Six things…" |
| `/for/saas/` | *"Five things SaaS founders consistently say about transactional email infrastructure. Each maps to a specific Vectis Mail capability."* | Same. |

Listicle leads work for human readers but not for AI citation. Recommendation: keep the "six things" framing as a section header, but precede it with a one-sentence direct answer:

> *"Vectis Mail is the email platform for agencies running mail infrastructure across many client domains under one organisation. One Pro subscription covers unlimited installs you operate. Here are six things agencies consistently need from email infrastructure, and how Vectis maps to each."*

**Effort:** 20 minutes total (4 /for/ pages). **AEO impact:** medium-high.

### A4 — Home page comp cards should be FAQ schema + tables

The home page has three comparison cards: *"vs Mailcow / iRedMail"*, *"vs SendGrid / Postmark / SES"*, *"vs Manual Postfix Setup"*. Currently these are prose-in-cards.

AI strongly prefers two patterns for comparison content:
1. **FAQ schema** — Q/A pairs that work as standalone snippets (matches how people phrase queries)
2. **Comparison tables** — structured extraction targets

**Recommended:**
- Wrap the three cards' content in `FAQPage` schema with Q/A pairs:
  - *Q: "What's the best alternative to Mailcow?"*
  - *Q: "What's the best self-hosted alternative to SendGrid?"*
  - *Q: "Should I use Vectis Mail instead of setting up Postfix manually?"*
- Each A is the existing card copy, lightly rewritten as a self-contained answer

This compounds with the SEO audit's finding (T-bullet missing FAQPage schema on home).

**Effort:** 1 hour. **AEO impact:** high — these are the highest-intent queries.

### A5 — pricing.md drift (Last updated: 2026-05-12 vs live page 2026-05-17)

The live `/pricing/` page was updated on 2026-05-17 (per its `<time>` tag, post the BSL FAQ rewrite). The machine-readable `/pricing.md` still says `Last updated: 2026-05-12`. AI agents reading the .md get a 5-day stale snapshot.

Specific drift to investigate:
- Did anything material change between 2026-05-12 and 2026-05-17 on the pricing page?
- The activation URL in pricing.md (`https://validonx.com/checkout/vectis-pro`) — per project memory, public Stripe checkout is gated on Pharlux Phase 2. Does that URL 200? If not, pricing.md is sending AI agents to a dead end.

**Effort:** 15 minutes (re-sync + verify activation URL). **AEO impact:** medium — keeps the agent-buying path clean.

### A6 — `/guides/self-host-email-2026/` missing visible date

Every other audited page has a `<time datetime="..."`> element. This one doesn't. Single page, single fix.

**Effort:** 5 minutes. **AEO impact:** medium — freshness signal on a flagship Phase 2 pillar.

### A7 — No author byline / E-E-A-T signal on any page

Princeton GEO research: expert quotes with name + title = +30% citation boost. Currently no page has a "Written by [Name]" or "Reviewed by [Name]" element.

Quick win: add a single-line byline to alt pages + guides:
> *"Written by Ian Holt — founder of Veltara Works. vectismail.com runs on Vectis Mail Pro in production since April 2026."*

This is the kind of self-attestation AI assistants treat as expertise signal. The "we run it ourselves" framing doubles as social proof.

**Note:** SEO Phase A3 (author bylines) was explicitly **deferred** per project memory (`project_seo_a3_deferred`) pending an authorship-framing decision. Worth revisiting now — the AEO citation boost is real and the decision is mostly "what name + role do we attribute things to?" which is simple in a solo-founder context.

**Effort:** 30 minutes. **AEO impact:** medium-high (cross-page) — compounding citation boost.

### A8 — Wikipedia / third-party citation surface is zero

AI Overviews and ChatGPT cite Wikipedia 7.8% of all the time (Princeton). Vectis Mail has no Wikipedia presence. This is **strategic, not tactical** — getting a Wikipedia entry takes editorial scrutiny and notability (citations from independent secondary sources).

**Not actionable as a quick fix.** Worth a discussion alongside the HN/Product Hunt launch planning — those launches generate the kind of secondary-source coverage Wikipedia editors look for when assessing notability.

### A9 — No comparison-table on /features/

The `/features/` page first paragraph is good (*"Vectis Mail replaces Mailcow, iRedMail, and external email APIs with a single, declarative platform."*) but the page has only one comparison-table marker (and that's the Starter-vs-Pro table). For AI citation, a "Vectis Mail vs typical mail server" feature comparison would be high-value — even just 8-10 rows.

**Effort:** 1 hour. **AEO impact:** medium.

### A10 — Could expand machine-readable file family

You have `pricing.md`. The ai-seo skill explicitly endorses this pattern. Adjacent opportunities:

| File | What it'd contain | AI consumer |
|---|---|---|
| `/about.md` | One-page company + product factsheet | "Who builds Vectis Mail?" |
| `/api.md` | Auth model + endpoint summary + rate limits | "Does Vectis Mail have an API?" |
| `/install.md` | 10-line install summary + system requirements | "How do I install Vectis Mail?" |
| `/security.md` | TLS, encryption-at-rest, AAA model, BSL implications | "Is Vectis Mail secure / compliant?" |

llms-full.txt covers most of this already, but per-topic .md files are more discoverable to AI agents that don't auto-fetch llms-full. Lower priority than the first-paragraph rewrites.

**Effort:** 1 hour per file. **AEO impact:** low-medium per file; compounds.

### A11 — Direct competitive comparisons inside llms.txt

The llms.txt currently has a "Competitive comparisons" section with only 2 entries (Mailcow + SendGrid) — but we have 5 alt pages live. Inconsistency between llms.txt and reality means AI agents reading the file miss 3 of our 5 comparison surfaces.

**Effort:** 5 minutes. **AEO impact:** low (but a 5-minute fix).

---

## Prioritised action plan

### Quick wins (≤2 hours total — do alongside the SEO audit fixes)

| # | Item | Effort | AEO impact |
|---|---|---|---|
| A6 | Add `<time>` to /guides/self-host-email-2026/ | 5 min | Medium |
| A11 | Add 3 missing alt pages to llms.txt | 5 min | Low |
| A5 | Sync /pricing.md to match /pricing/ + verify activation URL | 15 min | Medium |
| A1 | Rewrite home page first paragraph | 15 min | **High** |
| A2 | Rewrite 5 alt-page first paragraphs to /alternatives/sendgrid/ model | 30 min | **High** |
| A3 | Add direct-answer leads to 4 /for/ pages | 20 min | Medium-high |
| A4 | Wrap home page comp cards in FAQPage schema | 1 hour | **High** (compound with SEO audit T-finding) |

### Strategic decisions to make

| # | Item | Decision required |
|---|---|---|
| A7 | Add author bylines | Authorship framing — "Ian Holt, founder of Veltara Works" or "The Vectis Mail team"? |
| A8 | Wikipedia path | Wait for HN/Product Hunt traction first, then assess notability + pursue. |
| A10 | Expand /*.md files | Which next — /about.md, /api.md, /install.md, /security.md? Probably /security.md is most enterprise-aligned. |

### Medium-term work

| # | Item | Effort |
|---|---|---|
| A9 | Vectis-vs-typical-mail-server feature comparison table on /features/ | 1 hour |
| A10 | /about.md, /security.md, /install.md (pick 1-2) | 1 hour each |
| — | Reddit/HN/forum presence builds | Ongoing, integrate with HN/PH launch plan |

### Coordinate with HN/Product Hunt launch (per memory item)

Launch-day traffic gets indexed widely. Items to ship BEFORE launch:
- A1 (home first paragraph) — your front-page citation surface
- A2 (alt page leads) — high-purchase-intent surfaces
- A4 (home FAQPage) — multiplies "vs X" citation coverage
- The SEO audit's meta-description trim — gives launch-day SERP CTR a lift

The remaining items can land post-launch.

---

## Princeton GEO scorecard

Where Vectis Mail stands on the 9 optimization methods (KDD 2024 research, ranked by visibility boost):

| Method | Boost | State on vectismail.com | Gap |
|---|---:|---|---|
| **Cite sources** | +40% | Partial — llms.txt + llms-full.txt reference docs, but blog/guide content doesn't yet cite external sources for technical claims | Add inline citations to guides |
| **Add statistics** | +37% | Good — "14 containers", "60+ endpoints", "6-phase pipeline" appear regularly | Continue; add more on /features/, /for/ pages |
| **Add quotations** | +30% | None — no expert quotes anywhere | A7: add founder bylines + future customer quotes |
| **Authoritative tone** | +25% | Good on guides; mixed on marketing (some marketing voice still creeps in) | Edit pass on marketing pages for tone |
| **Improve clarity** | +20% | Good — pricing page is plain language, FAQ is plain language | Maintain |
| **Technical terms** | +18% | Good — Postfix, Dovecot, Rspamd, DKIM, ManageSieve, ACME, etc. used appropriately | Maintain |
| **Unique vocabulary** | +15% | Good — distinct product terminology ("tenant", "atomic update", "license grace") | Maintain |
| **Fluency optimization** | +15-30% | Good — copy reads well | Maintain |
| **Keyword stuffing** | **-10%** | None observed | ✅ Avoid temptation as content scales |

**Highest available gains:** A7 (quotations/bylines) and citation hygiene on guides.

---

## What I did NOT audit (intentional)

- **Per-page schema correctness** beyond presence (e.g. whether the `Article` schema on alt pages has correct author/date/headline) — needs Rich Results Test pass
- **AI Overview presence today** — requires manual checks on real queries via Google + ChatGPT + Perplexity. Worth a 1-hour session with a query list (the alternatives + the "self-host email" cluster + "Vectis Mail" branded). Currently we don't know if we're being cited at all.
- **Competitor citation analysis** — who's currently being cited by AI for our target queries. Same manual-check session.
- **GitHub README** — Phase 3.4 in roadmap; separate scope.
- **Brand-mention monitoring tooling** — Otterly/Peec/ZipTie/LLMrefs all do this. Worth a free-trial run once we have HN/PH traction.

---

## Files referenced

- `/opt/vectis/docs/notes/marketing-seo-roadmap.md` — source roadmap (mention AEO/GEO/LLMO § from line ~248)
- `docs/audits/seo/2026-05-18-site-wide-seo-audit.md` — companion traditional SEO audit (do these together)
- `docs/audits/pagespeed/2026-05-18-*` — PSI baseline + after-trailing-slash work shipped earlier today
