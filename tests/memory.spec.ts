import { expect, test } from '@playwright/test';
import { follow, NO_PLAYER, playerReady, state, watch } from './helpers';

// Playwright's trace recorder keeps hold of elements it has recorded, some of them
// gone from the page, which would count here as left behind. It can only be turned
// off for a whole file, so this test has a file of its own.
test.use({ trace: 'off' });

test('visiting Listen again and again leaves nothing behind', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/listen/');
  await playerReady(page);
  const withPlayer = await state(page);

  // Weak references to each visit's player, its elements and its audio element.
  const keep = () =>
    page.evaluate(() => {
      const w = window as any;
      const player = w.AblePlayer.lastCreated;
      w.visits ??= [];
      w.visits.push([player, document.querySelector('.able-wrapper'), player.media].map((x) => new WeakRef(x)));
    });
  const visit = async () => {
    await page.locator('.able-button-handler-play').click();
    await expect.poll(async () => (await state(page)).playing).toBe(1);
    await follow(page, 'Reviews');
    expect(await state(page)).toMatchObject(NO_PLAYER);
    await follow(page, 'Listen');
    await playerReady(page);
    expect(await state(page)).toEqual({ ...withPlayer, playing: 0 });
    await keep();
  };
  // Collects garbage until only the current visit's player is left, then counts the
  // page's elements and event listeners. Chrome keeps an audio element that has
  // played for a few seconds after it's removed, and the player with it.
  const cdp = await page.context().newCDPSession(page);
  const settled = async () => {
    await expect
      .poll(
        async () => {
          await cdp.send('HeapProfiler.collectGarbage');
          return page.evaluate(() => (window as any).visits.slice(0, -1).flat().filter((ref: WeakRef<object>) => ref.deref()).length);
        },
        { intervals: [500], timeout: 20_000 },
      )
      .toBe(0);
    return cdp.send('Memory.getDOMCounters');
  };

  await keep();
  await visit();
  const first = await settled();
  for (let i = 0; i < 5; i++) await visit();
  const last = await settled();
  expect(last).toEqual(first);

  expect(problems).toEqual([]);
});
