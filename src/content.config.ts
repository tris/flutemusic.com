import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { concertDate } from './lib/concert-dates';

const concerts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/concerts' }),
  schema: z.object({
    title: z.string(),
    date: z.string().refine((value) => {
      try { concertDate(value); return true; } catch { return false; }
    }, 'Use YYYY-MM-DD or YYYY-MM-DD HH:mm in America/Los_Angeles'),
    location: z.string().optional(),
    category: z.literal('concerts'),
  }),
});

export const collections = { concerts };
