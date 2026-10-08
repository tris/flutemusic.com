import { getCollection, type CollectionEntry } from 'astro:content';

// Concert dates are written in Santa Cruz time, as Jekyll read them (timezone in _config.yml).
const TIME_ZONE = 'America/Los_Angeles';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const wallClockFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric',
});

function wallClockAt(time: number): WallClock {
  const parts = Object.fromEntries(wallClockFormat.formatToParts(time).map(({ type, value }) => [type, Number(value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

function utcOf(w: WallClock): number {
  return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
}

// The instant at which a Santa Cruz clock reads `w`.
function timeOf(w: WallClock): number {
  let time = utcOf(w);
  for (let i = 0; i < 2; i++) time -= utcOf(wallClockAt(time)) - utcOf(w);
  return time;
}

function frontMatterWallClock(date: string | Date, file: string): WallClock {
  // YAML turns "2019-05-05" (and full timestamps) into Dates at UTC midnight, so the
  // UTC fields hold what was written.
  if (date instanceof Date) {
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
      hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() };
  }
  const m = date.match(/^(\d{4})-(\d\d?)-(\d\d?)(?:[ T](\d\d?):(\d\d)(?::(\d\d))?)?$/);
  if (!m) throw new Error(`${file}: can't read date "${date}"`);
  const [year, month, day, hour, minute, second] = m.slice(1).map((n) => Number(n ?? 0));
  return { year, month, day, hour, minute, second };
}

const pad = (n: number, width = 2, fill = '0') => String(n).padStart(width, fill);

// The strftime formats the Jekyll templates used, in Santa Cruz time.
export function strftime(time: number, format: string): string {
  const w = wallClockAt(time);
  const weekday = new Date(Date.UTC(w.year, w.month - 1, w.day)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  return format.replace(/%(-?)([ABdYmHMSlp])/g, (_, noPad: string, code: string) => {
    switch (code) {
      case 'A': return weekday;
      case 'B': return MONTHS[w.month - 1];
      case 'd': return noPad ? String(w.day) : pad(w.day);
      case 'Y': return String(w.year);
      case 'm': return pad(w.month);
      case 'H': return pad(w.hour);
      case 'M': return pad(w.minute);
      case 'S': return pad(w.second);
      case 'l': return pad(w.hour % 12 || 12, 2, ' ');
      case 'p': return w.hour < 12 ? 'AM' : 'PM';
      default: return _;
    }
  });
}

// Liquid's url_encode (Ruby's CGI.escape).
export function urlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

// Liquid's escape (Ruby's CGI.escapeHTML).
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface Concert {
  entry: CollectionEntry<'concerts'>;
  title: string;
  location?: string;
  start: number;
  allDay: boolean;
  html: string;
  // Jekyll's post URL, /:categories/:year/:month/:day/:title.html
  path: string;
}

// All concerts, newest first, like Jekyll's site.posts.
export async function getConcerts(): Promise<Concert[]> {
  const entries = await getCollection('concerts');
  return entries
    .map((entry) => {
      const { title, location, category } = entry.data;
      const wall = frontMatterWallClock(entry.data.date, entry.filePath ?? entry.id);
      const start = timeOf(wall);
      const slug = entry.id.replace(/^\d{4}-\d\d?-\d\d?-/, '');
      return {
        entry,
        title,
        location,
        start,
        allDay: wall.hour === 0 && wall.minute === 0 && wall.second === 0,
        html: entry.rendered?.html ?? '',
        path: `${category}/${strftime(start, '%Y/%m/%d')}/${slug}`,
      };
    })
    .sort((a, b) => b.start - a.start || (a.entry.id < b.entry.id ? 1 : -1));
}
