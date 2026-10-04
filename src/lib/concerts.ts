import { getCollection } from 'astro:content';
import { concertDate } from './concert-dates';

export async function getConcerts() {
  return (await getCollection('concerts')).sort((a, b) =>
    concertDate(b.data.date).toMillis() - concertDate(a.data.date).toMillis()
    || a.id.localeCompare(b.id),
  );
}
