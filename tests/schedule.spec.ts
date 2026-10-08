import { expect, test } from '@playwright/test';
import { follow, playerReady, state, watch } from './helpers';

test('the calendar is made on each visit and removed on the way out', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/schedule/');
  await expect(page.locator('#calendar .fc-view')).toHaveCount(1);
  // FullCalendar watches the window's size while it's on the page.
  expect((await state(page)).windowHandlers).toBe(1);

  // Concerts come from /events.json.
  await page.evaluate(() => (window as any).jQuery('#calendar').fullCalendar('gotoDate', '2019-04'));
  await expect(page.locator('.fc-event').filter({ hasText: 'Sinister Resonance' })).toHaveCount(1);

  await follow(page, 'Listen');
  await playerReady(page);
  await follow(page, 'Concert Schedule');
  await expect(page.locator('#calendar .fc-view')).toHaveCount(1);
  expect(await state(page)).toMatchObject({ ableElements: 0, nextIndex: 0, playing: 0 });
  // Able Player's key handler, and FullCalendar's resize handler.
  expect((await state(page)).windowHandlers).toBe(2);

  await follow(page, 'Biography');
  expect((await state(page)).windowHandlers).toBe(1);
  expect(problems).toEqual([]);
});
