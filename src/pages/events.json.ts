// The concerts for the FullCalendar view on /schedule/, newest first. Titles are
// HTML-escaped, apart from quotes, as the Jekyll template had them.
import type { APIRoute } from 'astro';
import { escapeHtml, getConcerts, strftime } from '../lib/concerts';

const TWO_HOURS = 2 * 60 * 60 * 1000;
const compact = (time: number) => strftime(time, '%Y%m%dT%H%M%S');

export const GET: APIRoute = async () => {
  const events = (await getConcerts()).map(({ title, start, allDay }) => ({
    title: escapeHtml(title).replaceAll('&quot;', '"'),
    ...(allDay
      ? { start: strftime(start, '%Y%m%d'), allDay: true }
      : { start: compact(start), end: compact(start + TWO_HOURS) }),
  }));
  return new Response(JSON.stringify(events, null, '\t'), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
