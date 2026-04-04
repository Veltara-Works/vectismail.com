// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
	site: 'https://vectismail.com',
	integrations: [
		starlight({
			title: 'Vectis Mail',
			description: 'Self-hosted email platform with declarative config, sending API, and enterprise features.',
			favicon: '/favicon.svg',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/Veltara-Works/vectis' },
			],
			customCss: ['./src/styles/custom.css'],
			components: {
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
					],
				},
				{
					label: 'Guides',
					items: [
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
