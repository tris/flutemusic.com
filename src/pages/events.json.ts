import type { APIRoute } from 'astro';
import { getConcerts } from '@/lib/concerts';
import { eventTimes } from '@/lib/concert-dates';

export const GET: APIRoute = async () => {
  const events = (await getConcerts()).map(({ data }) => ({
    title: data.title,
    ...eventTimes(data.date),
  }));
  return new Response(JSON.stringify(events, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
