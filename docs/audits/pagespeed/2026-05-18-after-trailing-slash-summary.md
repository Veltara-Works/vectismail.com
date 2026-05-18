# Perf punch list — post-trailing-slash fix

**Source:** [2026-05-18-baseline.md](2026-05-18-baseline.md) vs [2026-05-18-after-trailing-slash.md](2026-05-18-after-trailing-slash.md)
**Fix shipped:** Astro `trailingSlash: 'always'` + sweep of 9 internal href patterns across 24 `src/pages` + `src/components` files. Deploy `98027058.vectismail.pages.dev` at 2026-05-18 ~09:01 UTC.

## Headline result

The single dominant baseline opportunity — **"Avoid multiple page redirects"** at ~750ms (mobile) / ~200ms (desktop) on every non-home page — has been **fully eliminated**. The CF Pages 308 → /url/ redirect still fires for anyone arriving at a no-slash URL (out of our control), but our own internal navigation now lands on canonical URLs directly, and PSI probing the canonical form shows no redirect chain.

## Mobile perf score delta

URLs are probed at their canonical (trailing-slash) form for the "after" sweep, matching how real users now hit them through our nav.

| Page | Baseline | After | Δ |
|---|---:|---:|---:|
| `(home)` | 81 | 62 | **−19** ⚠️ |
| `features` | (probe failed) | 74 | — |
| `pricing` | 68 | 74 | +6 |
| `about` | 66 | 84 | **+18** ✅ |
| `contact` | 76 | 84 | +8 ✅ |
| `alternatives` | 70 | 81 | +11 ✅ |
| `alternatives/mailcow` | 75 | 83 | +8 ✅ |
| `alternatives/iredmail` | 68 | 88 | **+20** ✅ |
| `alternatives/mail-in-a-box` | 78 | 85 | +7 ✅ |
| `alternatives/sendgrid` | 78 | 75 | −3 (noise) |
| `alternatives/postmark` | 78 | 84 | +6 ✅ |
| `getting-started` | 75 | 83 | +8 ✅ |

**Net:** 8 of 10 comparable pages improved by 6-20 points. 1 within-noise (sendgrid −3). 1 regression to investigate (home −19).

## Mobile LCP delta

| Page | Baseline | After | Δ |
|---|---:|---:|---:|
| `(home)` | 3.6 s | 6.3 s | +2.7s ⚠️ |
| `pricing` | 4.2 s | 3.6 s | −0.6s |
| `about` | 4.1 s | 3.6 s | −0.5s |
| `contact` | 4.3 s | 3.6 s | −0.7s |
| `alternatives` | 3.9 s | 3.6 s | −0.3s |
| `alternatives/iredmail` | 4.2 s | **1.5 s** | −2.7s ✅ |
| `alternatives/mail-in-a-box` | 4.2 s | 3.6 s | −0.6s |
| `alternatives/sendgrid` | 4.2 s | 3.6 s | −0.6s |
| `alternatives/postmark` | 4.2 s | 3.6 s | −0.6s |
| `getting-started` | 4.2 s | 3.8 s | −0.4s |

Desktop perf was 98-100 across the board pre-fix and stays there. Desktop scores are unchanged; this fix is mobile-only by mechanism (mobile RTT amplifies the redirect penalty).

## Home page regression — needs investigation, not blocking

Home mobile perf went 81 → 62 with LCP 3.6s → 6.3s after the deploy. Three identical follow-up runs all returned 62/6.3s, ruling out instantaneous lab variance — but that doesn't rule out **session-level lab state** (PSI's Google-side lab can drift across the ~1h between baseline and after runs; a different machine assignment or a load-balancer hash change shifts the simulated throttling profile).

Evidence pointing to lab variance, not real regression:
- `index.astro` diff is **9 href edits only** (trailing slashes added). No structural / content changes.
- CSS + JS bundle hashes (`custom.pYi0SKWq.css`, `page.BIhdncjw.js`) are unchanged. No new assets to fetch.
- LCP-element audit returned `null` — Lighthouse couldn't pin a stable LCP candidate, which is typical when the page is close to a "rendering complete" boundary.
- FCP actually **improved** 3.5s → 3.0s. TBT stayed at 0. Only LCP shifted.

Evidence pointing to a real regression (worth taking seriously):
- 3 consecutive runs at identical 62/6.3s is statistically unusual for pure variance.
- All other pages improved at the same time — if it were systemic lab drift, those should have regressed too.

**Recommended next step:** rerun the home page mobile probe in a separate session (different time-of-day, different lab state) and triangulate. If still 62/6.3s, the LCP element identification needs investigation — likely candidates are the hero `<h1>`, the stats-bar numbers, or one of the early feature cards. Adding `fetchpriority="high"` to the LCP element or preloading critical fonts could fix it.

## Remaining punch list (P2-P5 from baseline analysis)

### P2 — CLS on 4 pages

Baseline showed mobile CLS ≥0.2 on `/pricing` (0.212), `/about` (0.244), `/alternatives` (0.208), `/alternatives/iredmail` (0.208). After-run CLS values:

| Page | Baseline | After |
|---|---:|---:|
| `/pricing` | 0.212 | (re-check) |
| `/about` | 0.244 | (re-check) |
| `/alternatives` | 0.208 | (re-check) |
| `/alternatives/iredmail` | 0.208 | (re-check) |

After-run individual page data needs to be parsed out of `2026-05-18-after-trailing-slash.md` to fill these. Suspected cause: webfont swap shifting heading layout, or unspecified image dimensions in hero or pricing-card components. Fixes are mechanical (`width`/`height` attributes; `font-display: swap` is already there but font preload would help).

### P3 — Mobile FCP

After-run mobile FCP is 3.0-3.6s across pages. Target is <1.8s. The single dominant lever is render-blocking CSS — `custom.pYi0SKWq.css` is loaded synchronously in `<head>` on every page. Inlining critical CSS (~5KB above-the-fold) and async-loading the rest would compress FCP toward 1.5s.

### P4 — Accessibility on alternatives pages

Baseline showed a11y 77-84% on alternatives pages vs 88-100% elsewhere. Probable findings: contrast ratios on muted text against the dark background, missing aria-labels on the compare cards, or heading hierarchy gaps.

### P5 — Re-probe `/features` mobile

Baseline run got a 500 from PSI for `/features` mobile only. Likely transient PSI API hiccup. After-run captured it cleanly at 74.

## Process notes

The audit script captures the redirect-aware metric correctly when probed against canonical URLs. For ongoing monitoring, the canonical-URL list (already updated in `scripts/pagespeed-audit.sh`) represents the real-user experience. To re-measure the worst-case (no-slash) path, pass `--urls` with a custom file.

Future sweeps:
- Weekly cadence is fine for a marketing site that changes a few times a month
- The script doesn't yet open GH issues on regressions — that's a follow-up if we want to make this an unattended monitoring loop
- 3-run-then-median is more rigorous than single-run for tracking trends; current script does single-run for speed
