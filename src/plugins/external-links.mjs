// Markdown links to other sites open in a new tab, matching the hand-built
// .astro pages (target="_blank" rel="noopener noreferrer"). Internal links,
// anchors, mailto: and tel: are left alone. Each external text link also gets
// a visible ↗ (hidden from screen readers) and screen-reader text saying it
// opens in a new tab, so the new tab is not a surprise (WCAG technique G201).
//
// Astro 7's default Markdown processor is Sätteri, which no longer runs
// `markdown.rehypePlugins`. Like Starlight, this integration adds a Sätteri
// hast plugin to the configured processor, so it covers every .md/.mdx page:
// the notes collection and the Starlight docs.

const SITE_HOSTS = new Set(['vectismail.com', 'www.vectismail.com']);

// Inline so it works in every layout (notes pages and Starlight) without
// relying on a global .sr-only class.
const SR_ONLY =
	'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

/** @param {unknown} href */
export function isExternal(href) {
	if (typeof href !== 'string' || !/^https?:\/\//i.test(href)) return false;
	try {
		return !SITE_HOSTS.has(new URL(href).hostname.toLowerCase());
	} catch {
		return false;
	}
}

/** Sätteri hast plugin. */
export const externalLinksHastPlugin = {
	name: 'vectis-external-links',
	element: {
		filter: ['a'],
		/** @param {any} node @param {any} ctx */
		visit(node, ctx) {
			const props = node.properties || {};
			if (!isExternal(props.href) || props.target != null) return;
			ctx.setProperty(node, 'target', '_blank');
			ctx.setProperty(node, 'rel', ['noopener', 'noreferrer']);
			// Image-only links get no text marker.
			if (!ctx.textContent(node).trim()) return;
			ctx.appendChild(node, [
				{
					type: 'element',
					tagName: 'span',
					properties: { ariaHidden: 'true', className: ['ext-link-icon'] },
					children: [{ type: 'text', value: ' ↗' }],
				},
				{
					type: 'element',
					tagName: 'span',
					properties: { style: SR_ONLY },
					children: [{ type: 'text', value: ' (opens in a new tab)' }],
				},
			]);
		},
	},
};

/** @returns {import('astro').AstroIntegration} */
export default function externalLinks() {
	return {
		name: 'vectis-external-links',
		hooks: {
			'astro:config:setup': ({ config, logger }) => {
				const hast = /** @type {any} */ (config.markdown?.processor)?.options?.hastPlugins;
				if (Array.isArray(hast)) hast.push(externalLinksHastPlugin);
				else logger.warn('Markdown processor is not Sätteri: external links will open in the same tab.');
			},
		},
	};
}
