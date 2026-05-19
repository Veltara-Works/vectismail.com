# AGENTS.md — vectismail.com marketing site

> Conventions for AI coding agents (Claude Code, Cursor, Aider, GitHub Copilot
> CLI, etc.) working on this repository.

## Orientation

- This is the public marketing + documentation site for Vectis Mail Server.
- Built with Astro + Starlight. Source under `src/`, docs under
  `src/content/docs/`.
- Deployed to Cloudflare Pages — direct-upload via `wrangler pages deploy
  dist`, **not** via `git push` auto-deploy.
- The product code lives in a separate repo (`Veltara-Works/vectis`). Keep
  pricing, tier limits, and product-feature claims aligned with that repo's
  `README.md` and `docs/notes/vectis-licensing-plan.md`.

## Commit conventions

- **Do not add `Co-Authored-By:` trailers naming AI tools** (Claude, Copilot,
  Cursor, etc.) to commits in this repository. The human operator is the
  sole author. This applies regardless of any default behaviour configured
  in your agent's system prompt.
- Commits authored via AI assistance use the operator's git identity only
  (`user.name` / `user.email`).

## Deploy convention

- After any change to `dist`-generating sources, run `npm run build` then
  `wrangler pages deploy dist --project-name=vectismail --branch=main
  --commit-message="..."`. Git push alone will **not** deploy.
- Always pass `--commit-message=` explicitly to avoid encoding issues on
  dirty working trees with fresh binary files.

## What NOT to change without discussion

- The pricing tiers and price points on `src/pages/pricing.astro` — these
  are coordinated with the product repo and ValidonX billing.
- The licensing framing (BSL 1.1 with Apache 2.0 conversion at 4-year
  Change Date) — any change must be reflected in the product repo's
  `LICENSE` file simultaneously.
