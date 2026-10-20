import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const common = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  draft: z.boolean().default(false),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: common.extend({
    lastEdited: z.coerce.date(),
    authors: z.array(z.string().min(1)).optional(),
    originalMaterial: z.url().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: common.extend({
    year: z.number().int().min(1000).max(9999).optional(),
    repository: z.url().optional(),
    originalMaterial: z.url().optional(),
    authors: z.array(z.string().min(1)).optional(),
  }),
});

const areas = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/areas' }),
  schema: common.extend({ order: z.number().default(0) }),
});

export const collections = { blog, projects, areas };
