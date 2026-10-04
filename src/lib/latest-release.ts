// Build-time lookup of the latest STABLE Vectis Mail release, read from the
// same manifest the installer and `vectis update` use. Feeds the "Latest
// release" line in both footers, so the site shows the current version
// without anyone hand-editing dates: redeploy after a release and it updates.
//
// Fetched once per build (module-level promise) no matter how many pages
// render it. Any failure (network, bad JSON, unexpected shape) logs a warning
// and returns null, which simply omits the line; a manifest hiccup must never
// break a site deploy.

const MANIFEST_URL = 'https://dl.vectismail.com/releases.json'
const RELEASE_NOTES_URL = 'https://github.com/Veltara-Works/vectis/releases/tag/'
const FETCH_TIMEOUT_MS = 8000

export interface LatestRelease {
	version: string
	releasedAt: Date
	notesUrl: string
}

let cached: Promise<LatestRelease | null> | undefined

export function getLatestRelease(): Promise<LatestRelease | null> {
	cached ??= load()
	return cached
}

async function load(): Promise<LatestRelease | null> {
	try {
		const res = await fetch(MANIFEST_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		const m = (await res.json()) as { latest?: unknown; released_at?: unknown; channel?: unknown }

		if (m.channel !== 'stable') throw new Error(`unexpected channel ${JSON.stringify(m.channel)}`)
		if (typeof m.latest !== 'string' || !/^v\d+\.\d+\.\d+$/.test(m.latest)) {
			throw new Error(`unexpected version ${JSON.stringify(m.latest)}`)
		}
		const releasedAt = new Date(String(m.released_at))
		if (Number.isNaN(releasedAt.getTime())) throw new Error(`unparseable released_at ${JSON.stringify(m.released_at)}`)

		return { version: m.latest, releasedAt, notesUrl: RELEASE_NOTES_URL + m.latest }
	} catch (err) {
		console.warn(`[latest-release] omitting footer release line: ${(err as Error).message}`)
		return null
	}
}

// "4 October 2026": the same style as the pages' "Last updated" dates, in
// Sydney time since that's where releases are cut.
export function formatReleaseDate(d: Date): string {
	return d.toLocaleDateString('en-AU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Australia/Sydney',
	})
}
