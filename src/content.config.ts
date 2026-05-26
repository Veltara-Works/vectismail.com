import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				howToName: z.string().optional(),
				howToSteps: z
					.array(
						z.object({
							name: z.string(),
							url: z.string(),
							text: z.string().optional(),
						}),
					)
					.optional(),
			}),
		}),
	}),
	notes: defineCollection({
		loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
		schema: z.object({
			title: z.string(),
			description: z.string(),
			pubDate: z.coerce.date(),
			updated: z.coerce.date().optional(),
			excerpt: z.string().optional(),
		}),
	}),
};
