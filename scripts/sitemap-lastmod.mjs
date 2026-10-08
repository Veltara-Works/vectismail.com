// Per-URL <lastmod> for the sitemap, taken from each page's own source file's
// last git commit. Google only trusts lastmod when it tracks real changes, so
// a build-time "now" on every URL would be worse than none: a URL with no
// resolvable source file is simply emitted without lastmod.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Source roots and the URL prefix each one serves under.
const ROOTS = [
	['src/pages', ''],
	['src/content/docs', ''],
	['src/content/notes', 'notes'],
];

function walk(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
	);
}

// Mirrors the site's slugging: lowercase, dots dropped (release-notes/v0.1.0.md
// -> /release-notes/v010/), index files serve their directory.
function urlFor(root, prefix, file) {
	const segs = relative(root, file)
		.replace(/\.(astro|mdx?)$/, '')
		.split(sep)
		.map((s) => s.toLowerCase().replace(/\./g, ''));
	if (segs.at(-1) === 'index') segs.pop();
	if (segs.some((s) => s.startsWith('['))) return null; // dynamic route
	const path = [prefix, ...segs].filter(Boolean).join('/');
	return '/' + (path ? path + '/' : '');
}

// One git pass: newest commit date per file under src/.
function gitDates() {
	const dates = new Map();
	let out;
	try {
		out = execFileSync('git', ['log', '--format=@%cI', '--name-only', '--', 'src'], {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
		});
	} catch {
		return dates; // no git (e.g. a tarball build): omit lastmod everywhere
	}
	let current = null;
	for (const line of out.split('\n')) {
		if (line.startsWith('@')) current = line.slice(1);
		else if (line && current && !dates.has(line)) dates.set(line, current);
	}
	return dates;
}

export function lastmodByPath() {
	const dates = gitDates();
	const byPath = new Map();
	for (const [root, prefix] of ROOTS) {
		for (const file of walk(root)) {
			if (!/\.(astro|mdx?)$/.test(file)) continue;
			const url = urlFor(root, prefix, file);
			const date = dates.get(file.split(sep).join('/'));
			if (url && date) byPath.set(url, date);
		}
	}
	return byPath;
}
