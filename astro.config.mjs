// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
	site: 'https://vectismail.com',
	// CF Pages enforces trailing-slash with a 308 redirect. Match that
	// here so the build emits trailing-slash canonicals and the dev
	// server's behaviour matches prod. Internal href="" links across
	// src/ must use the trailing-slash form to avoid the 308 round-trip
	// (PSI mobile penalty ~750ms per click before this was set).
	trailingSlash: 'always',
	integrations: [
		// Explicit sitemap so we can filter out non-indexable pages
		// (e.g. /account/billing/done/ — the post-Stripe-portal landing
		// page is already noindex but should also be excluded from the
		// sitemap submitted to Search Console). Starlight pulls
		// @astrojs/sitemap as a transitive dep; declaring it here lets
		// us pass a filter.
		sitemap({
			filter: (page) => !page.includes('/account/billing/done'),
		}),
		starlight({
			title: 'Vectis Mail',
			description: 'Self-hosted email platform with declarative config, sending API, and enterprise features.',
			lastUpdated: true,
			favicon: '/favicon.svg',
			head: [
				{
					tag: 'link',
					attrs: { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
				},
			],
			logo: {
				src: './public/brand/logos/vectis-mail-wings.png',
				alt: 'Vectis Mail',
			},
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Veltara-Works/vectis' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
				Head: './src/components/Head.astro',
				Header: './src/components/Header.astro',
				Footer: './src/components/Footer.astro',
			},
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Introduction', slug: 'getting-started' },
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Your First Domain', slug: 'getting-started/first-domain' },
						{ label: 'DNS Setup', slug: 'getting-started/dns-setup' },
						{ label: 'Activating Pro', slug: 'getting-started/pro-activation' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Should You Self-Host Email?', slug: 'guides/self-host-email-2026' },
						{ label: 'DKIM, SPF & DMARC', slug: 'guides/dkim-spf-dmarc' },
						{ label: 'TLS Certificates', slug: 'guides/tls-certificates' },
						{ label: 'IP Warmup', slug: 'guides/ip-warmup' },
						{ label: 'Deliverability', slug: 'guides/deliverability' },
						{ label: 'Cloudflare Integration', slug: 'guides/cloudflare' },
						{ label: 'Troubleshooting', slug: 'guides/troubleshooting' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Overview & Auth', slug: 'api' },
						{ label: 'Domains', slug: 'api/domains' },
						{ label: 'Mailboxes', slug: 'api/mailboxes' },
						{ label: 'Aliases', slug: 'api/aliases' },
						{ label: 'Sending Email', slug: 'api/sending' },
						{ label: 'Webhooks', slug: 'api/webhooks' },
						{ label: 'Messages & Storage', slug: 'api/messages' },
						{ label: 'Analytics', slug: 'api/analytics' },
						{ label: 'Admin & RBAC', slug: 'api/admin' },
					],
				},
				{
					label: 'CLI Reference',
					items: [
						{ label: 'Overview', slug: 'cli' },
						{ label: 'Commands', slug: 'cli/commands' },
					],
				},
				{
					label: 'Architecture',
					items: [
						{ label: 'Overview', slug: 'architecture/overview' },
					],
				},
			],
		}),
	],
});
