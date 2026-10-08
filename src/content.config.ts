import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One Markdown file per concert, formerly Jekyll's _posts.
const concerts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/concerts' }),
  schema: z.object({
    title: z.string(),
    // Santa Cruz time: "2015-02-27 20:00", or a bare date for an all-day listing.
    // YAML reads the bare date as a Date and the date with a time as a string.
    date: z.union([z.string(), z.date()]),
    location: z.string().optional(),
    category: z.string(),
  }),
});

export const collections = { concerts };
