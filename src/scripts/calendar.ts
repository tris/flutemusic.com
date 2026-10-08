// The FullCalendar month view on /schedule/. The client router keeps window and
// document between pages, so the calendar is made on each visit to the page and
// destroyed on the way out, which also removes FullCalendar's handlers from them.
import jqueryUrl from '../vendor/jquery-3.2.1.min.js?url';
import momentUrl from '../vendor/moment-2.24.0.min.js?url';
import fullCalendarUrl from '../vendor/fullcalendar-3.2.0/fullcalendar.min.js?url';
import { loadScripts } from './load-script';

document.addEventListener('astro:page-load', async () => {
  const calendar = document.getElementById('calendar');
  if (!calendar) return;
  await loadScripts([jqueryUrl, momentUrl, fullCalendarUrl]);
  // The visitor may have moved on while the scripts were loading.
  if (!calendar.isConnected) return;

  const $calendar = (window as unknown as { jQuery: any }).jQuery(calendar);
  $calendar.fullCalendar({
    events: '/events.json',
  });
  // The month of the next concert, if there is one.
  const { gotoDate } = calendar.dataset;
  if (gotoDate) $calendar.fullCalendar('gotoDate', gotoDate);

  document.addEventListener('astro:before-swap', () => $calendar.fullCalendar('destroy'), { once: true });
});
