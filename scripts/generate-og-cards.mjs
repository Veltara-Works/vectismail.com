#!/usr/bin/env node
// Generate Open Graph cards (1200x630 PNG) from SVG templates via sharp.
// Run: node scripts/generate-og-cards.mjs
//
// Requires Inter installed in fontconfig so librsvg can render <text>.
// On Linux:
//   cp public/brand/fonts/Inter-VariableFont_opsz_wght.ttf ~/.local/share/fonts/
//   fc-cache -f
//
// Card variants:
//   - alt:      "ALTERNATIVE TO X" headline; matches existing mailcow/sendgrid PNGs
//   - usecase:  "BUILT FOR X" headline; big benefit line; for /for/* pages
//   - pillar:   "GUIDE · 2026" tag; big multi-line title; for cornerstone content

import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const OG_DIR = resolve(ROOT, 'public/og')

// Brand colours (mirrors src/styles/custom.css)
const BG = '#0C0C0D'
const BG_HIGHLIGHT = '#161A1F'
const CYAN = '#1FB7FF'
const WHITE = '#FFFFFF'
const GRAY1 = '#ECEEF2'
const GRAY2 = '#C0C2C7'
const GRAY3 = '#888B96'
const SILVER = '#D8D9DE'

const WINGS_PATHS = `
<polygon points="620 0 577.2 70.4 458.34 120.88 267.54 440.19 240.24 395.29 423.56 81.57 620 0"/>
<polygon points="555.97 105.32 514.95 172.81 432.86 206.41 472.64 140.25 555.97 105.32"/>
<polygon points="494.52 206.42 309.97 510.01 280.02 460.73 413.36 238.87 494.52 206.42"/>
<polygon points="194.36 81.57 297.37 251.14 268.52 302.45 162.53 120.88 42.79 70.4 0 0 194.36 81.57"/>
<polygon points="205.37 238.86 256.46 323.91 227.82 374.84 125.45 206.42 205.37 238.86"/>
<polygon points="146.1 140.18 185.88 206.41 105.03 172.81 63.97 105.25 146.1 140.18"/>
`

// Escape text content for SVG (no markup expected in inputs we control).
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Shared backdrop: deep brand-dark with a subtle top-right glow + bottom-left vignette.
function backdrop() {
	return `
<defs>
  <radialGradient id="glow" cx="0.88" cy="0.1" r="0.9">
    <stop offset="0" stop-color="${BG_HIGHLIGHT}" stop-opacity="1"/>
    <stop offset="1" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="stripe" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${CYAN}"/>
    <stop offset="1" stop-color="#26C2F6"/>
  </linearGradient>
</defs>
<rect width="1200" height="630" fill="${BG}"/>
<rect width="1200" height="630" fill="url(#glow)"/>
<rect x="0" y="0" width="1200" height="6" fill="url(#stripe)"/>
`
}

// Wings logo, scaled and translated. viewBox of source is 620x510.
function wings(x, y, height) {
	const scale = height / 510
	const width = 620 * scale
	return `
<g transform="translate(${x},${y}) scale(${scale})" fill="${SILVER}">
  ${WINGS_PATHS}
</g>` + '' // width tracked here for layout: ${width}
}

function altCard({ product, slug }) {
	const label = 'ALTERNATIVE TO'
	const headlineProduct = product
	const url = `vectismail.com/alternatives/${slug}`
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
${backdrop()}
${wings(80, 90, 140)}
<text x="270" y="138" font-family="Inter, sans-serif" font-weight="700" font-size="32" letter-spacing="3" fill="${GRAY3}">${esc(label)}</text>
<text x="270" y="240" font-family="Inter, sans-serif" font-weight="800" font-size="112" fill="${WHITE}">${esc(headlineProduct)}</text>

<text x="80" y="408" font-family="Inter, sans-serif" font-weight="800" font-size="64" fill="${CYAN}">Vectis Mail</text>
<text x="80" y="478" font-family="Inter, sans-serif" font-weight="800" font-size="64" fill="${WHITE}">vs ${esc(product)}</text>
<text x="80" y="534" font-family="Inter, sans-serif" font-weight="500" font-size="30" fill="${GRAY2}">Self-hosted. Same control. Modern surface.</text>
<text x="80" y="590" font-family="Inter, sans-serif" font-weight="700" font-size="26" fill="${CYAN}">${esc(url)}</text>
</svg>`
}

function usecaseCard({ audience, headline, subhead, slug }) {
	const url = `vectismail.com/for/${slug}`
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
${backdrop()}
${wings(80, 90, 140)}
<text x="270" y="138" font-family="Inter, sans-serif" font-weight="700" font-size="32" letter-spacing="3" fill="${GRAY3}">BUILT FOR</text>
<text x="270" y="240" font-family="Inter, sans-serif" font-weight="800" font-size="${audience.length > 12 ? 88 : 112}" fill="${WHITE}">${esc(audience)}</text>

<text x="80" y="400" font-family="Inter, sans-serif" font-weight="800" font-size="58" fill="${CYAN}">${esc(headline)}</text>
<text x="80" y="478" font-family="Inter, sans-serif" font-weight="500" font-size="32" fill="${GRAY1}">${esc(subhead)}</text>
<text x="80" y="590" font-family="Inter, sans-serif" font-weight="700" font-size="26" fill="${CYAN}">${esc(url)}</text>
</svg>`
}

function pillarCard({ tag, titleTop, titleBot, subhead, url }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
${backdrop()}
${wings(80, 90, 140)}
<text x="270" y="138" font-family="Inter, sans-serif" font-weight="700" font-size="32" letter-spacing="3" fill="${GRAY3}">${esc(tag)}</text>
<text x="270" y="240" font-family="Inter, sans-serif" font-weight="800" font-size="64" fill="${WHITE}">${esc(titleTop)}</text>

<text x="80" y="408" font-family="Inter, sans-serif" font-weight="800" font-size="80" fill="${CYAN}">${esc(titleBot)}</text>
<text x="80" y="478" font-family="Inter, sans-serif" font-weight="500" font-size="30" fill="${GRAY1}">${esc(subhead)}</text>
<text x="80" y="590" font-family="Inter, sans-serif" font-weight="700" font-size="26" fill="${CYAN}">${esc(url)}</text>
</svg>`
}

// ── Card manifest ─────────────────────────────────────────────────────────
const cards = [
	// Alternatives (round-2 ones still on default.png)
	{ file: 'alternatives-iredmail.png',     svg: altCard({ product: 'iRedMail',     slug: 'iredmail' }) },
	{ file: 'alternatives-mail-in-a-box.png', svg: altCard({ product: 'Mail-in-a-Box', slug: 'mail-in-a-box' }) },
	{ file: 'alternatives-postmark.png',     svg: altCard({ product: 'Postmark',     slug: 'postmark' }) },

	// Use-case / for-pages
	{ file: 'for-saas.png',        svg: usecaseCard({ audience: 'SAAS FOUNDERS', headline: 'Flat-priced email infra',     subhead: 'Transactional + mailbox + multi-tenancy on one self-hosted platform.', slug: 'saas' }) },
	{ file: 'for-agencies.png',    svg: usecaseCard({ audience: 'AGENCIES',      headline: 'One platform, every client',   subhead: 'Multi-tenant mail hosting with per-client domains, quotas, billing.', slug: 'agencies' }) },
	{ file: 'for-developers.png',  svg: usecaseCard({ audience: 'DEVELOPERS',    headline: 'REST API. CLI. Webhooks.',     subhead: 'The email infra you would build yourself — already shipped.',         slug: 'developers' }) },
	{ file: 'for-enterprises.png', svg: usecaseCard({ audience: 'ENTERPRISES',   headline: 'Sovereign email infra',        subhead: 'Self-hosted control, audit trails, on-prem deploy — no per-seat tax.', slug: 'enterprises' }) },

	// Pillar guides
	{ file: 'guides-self-host-email-2026.png', svg: pillarCard({
		tag: 'GUIDE · 2026',
		titleTop: 'Should you self-host email?',
		titleBot: 'The 2026 decision guide',
		subhead: 'TCO math, deliverability reality, when SaaS still wins, when self-hosting does.',
		url: 'vectismail.com/guides/self-host-email-2026',
	}) },
]

async function main() {
	await mkdir(OG_DIR, { recursive: true })
	for (const { file, svg } of cards) {
		const out = resolve(OG_DIR, file)
		await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out)
		console.log(`✓ ${file}`)
	}
}

main().catch((e) => {
	console.error(e)
	process.exit(1)
})
