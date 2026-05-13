import { defineCollection, z } from 'astro:content';
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
};
