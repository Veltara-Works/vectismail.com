# Copilot review guidance

This file tells GitHub Copilot how to review pull requests in this repository. Copy this file verbatim to other repos in the same family; only the **Repo-specific notes** block at the bottom needs per-repo editing.

---

## What we want from a Copilot review

Treat reviews like a senior engineer's — **terse, actionable, opinionated**. A Copilot review should:

- Surface bugs, security issues, and regressions a human reviewer might miss in a long diff.
- Flag architectural drift (mixing concerns, leaking abstractions across layer boundaries).
- Catch hidden state changes — anything that affects shared infrastructure, prod data, billing, auth, or audit trails.
- Note when test coverage is missing for new behavior **that warrants a test**. Don't ask for tests on trivial refactors, doc changes, or lockfile bumps.

What we **do NOT** want:

- Style nits — formatters and linters are wired into CI; don't comment on indentation, whitespace, or operator spacing.
- Trivial naming suggestions ("consider renaming `x` to `xValue`") unless the existing name is genuinely misleading.
- "Consider adding a comment here" suggestions. Comments are deliberately sparse in this codebase; only flag missing comments where a non-obvious WHY would help a future reader.
- Re-explaining what the code does in your review summary. Assume the reviewer can read.
- Speculation about hypothetical future requirements ("you might want to add caching later"). Review what's in the diff, not what isn't.
- Suggestions to add try/catch, defensive nulls, or input validation for code paths that already trust their callers (internal-only services). Only flag missing defenses at system boundaries (HTTP handlers, message queues, external API responses).

---

## Read the PR description first

The PR description is the author's intent — the diff is the implementation. **Always read the PR body before reviewing the diff.**

If the PR is lockfile-only (e.g. `package-lock.json`, `composer.lock`, `yarn.lock`, `Cargo.lock`):

- The diff is auto-generated. Don't try to "review" the lockfile content.
- The meaningful review surface is the **PR description**: what advisories does it close, what versions are bumped, what's the risk justification, what's been verified.
- If the description is missing security/risk justification, that's the comment to make. If the description has it, the review is "looks good — security justification is documented."

If the PR is a doc-only change, skip suggestions about implementation patterns. Review for clarity, accuracy, and outdated cross-references.

---

## Security review focus areas

Treat these as load-bearing. A miss here is an actual incident vector:

1. **Authentication / authorization bypass** — any new endpoint must have an auth middleware (or be explicitly public with a comment saying why). Any new admin-scoped route must reject non-admin actors.
2. **SQL injection / template injection / command injection** — any string concatenated into a query, shell command, or template is suspect unless using parameterized APIs.
3. **Cross-tenant leakage** — in multi-tenant code, every query that reads tenant data must scope by tenant ID. A query without a tenant scope is a bug.
4. **Audit trail gaps** — security-relevant mutations (auth changes, billing, key issuance, admin user edits) must call the audit service. Non-security state changes (UX state, view counters) should NOT pollute the audit log.
5. **Secrets in logs / responses / commit history** — passwords, API keys, tokens, JWTs, signing keys must never appear in logs, error messages, audit metadata, or test fixtures. Hashed passwords are also sensitive (the bcrypt cost prefix `$2y$` is a tell).
6. **Insecure defaults** — config switches that default to insecure (auth off, signature verification disabled, TLS verify off) should fail loudly, not silently.
7. **Webhook / signature verification** — inbound webhooks must verify signatures before any state-affecting work. Outbound webhooks must sign their payloads.

---

## Migration safety

Database migrations land via deploy and aren't trivially revertible. Flag:

- `ALTER TABLE` on a populated table without a chunked / online strategy.
- Adding a `NOT NULL` column without a default or a backfill plan.
- Dropping a column or table without a transitional read-and-drop sequence.
- Migrations that aren't reversible (`down()` empty or non-functional).
- `DROP`, `TRUNCATE`, `DELETE` without a `WHERE` — these should never appear in a migration outside of explicit tear-down for fresh installs.

If the migration is additive and small (new table, new nullable column, new index), no comment needed.

---

## API contracts

If a route, endpoint shape, response envelope, or webhook payload changes:

- Flag any breaking change to a documented contract. Documented = appears in OpenAPI, in `docs/`, or in a public SDK.
- Versioning: API versions in URLs (`/v1/...`) should not have their contracts mutated; new behavior goes to `/v2/...` or via opt-in headers.
- Inbound and outbound webhook payloads are public contracts the moment a third party consumes them.

---

## Commit and PR hygiene

Don't comment on these unless something is genuinely off:

- Commit messages should describe the **why**, not the what. The `what` is in the diff.
- PR titles should be short (under 70 chars). Detail goes in the body.
- Branch names: `feat/...`, `fix/...`, `chore/...`, `docs/...` are conventional.
- **Never suggest adding `Co-Authored-By: Claude` (or any other AI-attribution trailer)** to commit messages, PR bodies, or release notes. AI involvement may be mentioned in marketing copy; commit metadata is not the place.

---

## Tone and format of review comments

- One sentence per comment is usually enough. Two if you need to point at a fix.
- Use code-suggestion blocks for concrete one-line fixes.
- Group related findings into one comment rather than scattering five identical suggestions across a file.
- If a finding is severity-relevant, lead with severity: "**Bug:** ...", "**Security:** ...", "**Architecture:** ...". If unprefixed, the reader assumes "nit."
- Prefer "Consider X because Y" over "You should X." We treat reviews as recommendations, not commands.
- Don't apologize, don't hedge with "I might be wrong but..." — say what you think, the author can push back.

---

## Repo-specific notes

> **Edit this section per repo.** Everything above is the same across the Veltara Works family.

- This repo is **`Veltara-Works/vectismail.com`** — the **public** marketing site + customer-facing documentation for Vectis Mail Server. Astro static site (`astro.config.mjs`), TypeScript, deployed to Cloudflare Pages/Workers via `wrangler.toml` + `functions/`. Sister repo `Veltara-Works/vectis` carries the actual Go server.
- **This repo is PUBLIC.** Treat every change as world-readable and indexable. No secrets, no API keys, no internal-only screenshots, no leaked customer addresses. `wrangler.toml` should reference Cloudflare secrets by name only — never inline them. If a PR adds anything that smells like a credential, that's a security finding, not a nit.
- **Marketing copy must match shipped product.** This is the load-bearing rule for this repo. If a PR claims a feature, version, CLI command, pricing tier, or supported integration that isn't actually live in `Veltara-Works/vectis` at the named version, flag it. "Half right is WRONG" — at GA we fix advertised gaps properly rather than ship + document.
- **Documentation accuracy in `src/content/docs/`.** When a PR modifies install/upgrade/recipe docs, check that the commands and flags still match `scripts/install.sh` + `cmd/vectis/` in the `vectis` repo. Out-of-date docs are a real customer issue (have caused live install failures historically). Particular attention: `getting-started/installation.md` (PTR/SSH/email prereqs, hostname + email prompt order, post-install steps) and any `release-notes/` page.
- **Release notes per published Vectis tag.** Every stable Vectis release (e.g. v0.1.10, v0.1.11, v0.1.12) should have a corresponding `src/content/docs/release-notes/v0.1.X.md` page. Flag stable-tag-bump PRs that don't include the release-notes page.
- **R2 downloads landing page sync.** When the marketing copy changes in a way that affects the downloads or installer-banner story, the `dl.vectismail.com` `index.html` (in R2, not in this repo) must also be updated. Flag PRs that mention dl.vectismail.com without the corresponding R2 update note in the description.
- **Channel terminology — be precise.** `releases-stable.json` is the GA channel; `releases-rc.json` is pre-release; `releases.json` is the legacy alias mirroring stable. Don't conflate them in customer-facing copy. The customer install path uses stable by default; rc is opt-in via env override.
- **Install flow terminology.** `install.sh` "downloads" Vectis to `/usr/local/bin/vectis`; `vectis install` "installs" the actual stack. Editing `/etc/vectis/config.yaml` is an explicit user step between them — never describe `vectis install` itself as interactive (it isn't).
- **No internal-only context.** This is the public-facing voice of the product — don't merge content that belongs in `BUILD_CONTEXT.md`, ADRs, or the private `vectis` repo's internal docs. If a PR cross-references a private repo's path, that's a finding (link will 404 for customers).
- **Pricing / packaging changes are load-bearing.** Free vs Pro vs Enterprise tier feature splits are wired to FeatureGate in the server (`vectis` repo). If a PR moves a feature between tiers in marketing copy, the corresponding FeatureGate change must already be live in a shipped Vectis release — flag if not.
- **Astro static-site invariants.** Don't break the build — Astro's TypeScript-strict, `npm run build` must succeed. Sitemap + canonical URLs are auto-generated; manual overrides are usually a smell. Image assets under `public/` should be optimised (WebP/AVIF preferred) for delivery cost.
- **Cloudflare Pages/Workers deploy.** `wrangler.toml` + `functions/` define the runtime. Any new function should have a clear purpose tied to a marketing surface (form handler, redirect, headers); flag PRs that introduce server-side state or auth — those belong in the `vectis` API.
- **Privacy footprint.** No third-party analytics or trackers without an explicit decision recorded in the PR description. The product's whole pitch is self-hosted privacy; the marketing site has to walk that talk.
