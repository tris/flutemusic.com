import { DateTime } from 'luxon';

export const CONCERT_TIMEZONE = 'America/Los_Angeles';
const COMPACT_DATE = "yyyyLLdd'T'HHmmss";

// Concert times are Los Angeles wall times, regardless of the build machine's TZ.
export function concertDate(value: string): DateTime {
  const date = DateTime.fromISO(value.replace(' ', 'T'), { zone: CONCERT_TIMEZONE });
  if (!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}(?::\d{2})?)?$/.test(value) || !date.isValid) {
    throw new Error(`Invalid concert date: ${value}`);
  }
  return date.setLocale('en-US');
}

export function eventTimes(value: string) {
  const start = concertDate(value);
  if (start.hour === 0 && start.minute === 0 && start.second === 0) {
    return { start: start.toFormat('yyyyLLdd'), allDay: true as const };
  }
  return {
    start: start.toFormat(COMPACT_DATE),
    end: start.plus({ hours: 2 }).toFormat(COMPACT_DATE),
  };
}

export function concertDateLabel(value: string): string {
  const date = concertDate(value);
  return date.toFormat(eventTimes(value).allDay ? 'cccc, LLLL d, yyyy' : 'cccc, LLLL d, yyyy, h:mm a');
}

export function concertPath(id: string, date: string): string {
  const slug = id.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  return `${concertDate(date).toFormat('yyyy/LL/dd')}/${slug}`;
}

export function googleCalendarLink(title: string, date: string, details: string, location = ''): string {
  const times = eventTimes(date);
  const query = new URLSearchParams({
    action: 'TEMPLATE', text: title,
    dates: `${times.start}/${times.end ?? concertDate(date).plus({ days: 1 }).toFormat('yyyyLLdd')}`,
    ctz: CONCERT_TIMEZONE, details, location, trp: 'false',
  });
  return `https://www.google.com/calendar/render?${query}`;
}
