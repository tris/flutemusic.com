import test from 'node:test';
import assert from 'node:assert/strict';
import { concertDate, concertDateLabel, concertPath, eventTimes, googleCalendarLink } from '../src/lib/concert-dates.ts';

test('concert times use Los Angeles offsets in winter and summer', () => {
  assert.equal(concertDate('2015-01-24 15:00').toUTC().toISO(), '2015-01-24T23:00:00.000Z');
  assert.equal(concertDate('2019-04-28 15:00').toUTC().toISO(), '2019-04-28T22:00:00.000Z');
  assert.equal(concertDateLabel('2019-04-28 15:00'), 'Sunday, April 28, 2019, 3:00 PM');
});

test('all-day concerts stay all-day without shifting their calendar date', () => {
  assert.deepEqual(eventTimes('2019-05-05'), { start: '20190505', allDay: true });
  assert.deepEqual(eventTimes('2019-05-05 00:00'), { start: '20190505', allDay: true });
  assert.equal(concertDateLabel('2019-05-05'), 'Sunday, May 5, 2019');
});

test('two-hour durations handle day rollover and daylight saving transitions', () => {
  assert.deepEqual(eventTimes('2026-12-31 23:00'), { start: '20261231T230000', end: '20270101T010000' });
  assert.deepEqual(eventTimes('2026-03-08 01:30'), { start: '20260308T013000', end: '20260308T043000' });
  assert.deepEqual(eventTimes('2026-11-01 00:30'), { start: '20261101T003000', end: '20261101T013000' });
});

test('legacy concert paths use the frontmatter date, including the historical duplicate', () => {
  assert.equal(concertPath('2015-02-13-beauty-and-the-beast', '2015-02-14 19:00'), '2015/02/14/beauty-and-the-beast');
  assert.equal(concertPath('2015-02-20-beauty-and-the-beast-am', '2015-02-20 09:00'), '2015/02/20/beauty-and-the-beast-am');
});

test('calendar links encode punctuation, HTML descriptions, and locations correctly', () => {
  const url = new URL(googleCalendarLink('Music & "Madness"', '2019-04-28 15:00', '<p>Flute & piano</p>', 'Santa Cruz, CA'));
  assert.equal(url.searchParams.get('text'), 'Music & "Madness"');
  assert.equal(url.searchParams.get('details'), '<p>Flute & piano</p>');
  assert.equal(url.searchParams.get('location'), 'Santa Cruz, CA');
  assert.equal(url.searchParams.get('dates'), '20190428T150000/20190428T170000');
  assert.equal(url.searchParams.get('ctz'), 'America/Los_Angeles');
});

test('invalid or ambiguous input formats are rejected', () => {
  for (const value of ['invalid', '2019-02-30', '2019-04-28T15:00Z', '04/28/2019']) {
    assert.throws(() => concertDate(value), /Invalid concert date/);
  }
});
