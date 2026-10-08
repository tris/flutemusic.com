import { type APIResponse, expect, test } from '@playwright/test';
import { back, follow, forward, playerReady, state, watch } from './helpers';

// Once Able Player's script has loaded, it keeps one key handler on window for
// good. It only acts while there's exactly one player.
const NO_PLAYER = { ableElements: 0, players: 0, nextIndex: 0, windowHandlers: 1, documentHandlers: 0, playing: 0 };

test('the player stops when the visitor moves on, and comes back working', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/listen/');
  await playerReady(page);
  const withPlayer = await state(page);

  await page.locator('.able-button-handler-play').click();
  await expect.poll(async () => (await state(page)).playing).toBe(1);

  await follow(page, 'Biography');
  expect(await state(page)).toMatchObject({ path: '/bios/', ...NO_PLAYER });

  // Able Player sends key presses to its only player, so with a player left over
  // from /listen/, the space bar here would start the music again.
  await page.keyboard.press('Space');
  await page.keyboard.press('Control+Alt+KeyP');
  await page.waitForTimeout(500);
  expect((await state(page)).playing).toBe(0);

  await back(page);
  await playerReady(page);
  expect(await state(page)).toEqual(withPlayer);

  // The space bar works on the new player.
  await page.keyboard.press('Space');
  await expect.poll(async () => (await state(page)).playing).toBe(1);
  expect((await state(page)).playingOffPage).toBe(0);

  await forward(page);
  expect(await state(page)).toMatchObject({ path: '/bios/', ...NO_PLAYER });

  expect(problems).toEqual([]);
});

test('picking another track while playing switches to it', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/bios/');
  await follow(page, 'Listen');
  await playerReady(page);

  await page.locator('.able-button-handler-play').click();
  await expect.poll(async () => (await state(page)).playing).toBe(1);
  await page.getByRole('listitem').filter({ hasText: "Brian Boru's March" }).click();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('audio')!.currentSrc))
    .toContain('/listen/brian-boru-excerpt-applause.mp3');
  await expect.poll(async () => (await state(page)).playing).toBe(1);

  expect(problems).toEqual([]);
});

test('visiting again and again leaves nothing behind', async ({ page }) => {
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

test('leaving while the player is still being built', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/bios/');
  await follow(page, 'Listen');
  await playerReady(page);
  await follow(page, 'Biography');

  // Able Player's scripts are loaded now, so the next visit starts building a player
  // straight away. Leave the moment it starts.
  const leftWhileBuilding = page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        document.addEventListener(
          'astro:page-load',
          () => {
            setTimeout(() => {
              const { AblePlayer } = window as any;
              resolve(AblePlayer.nextIndex === 1 && AblePlayer.lastCreated.initializing !== false);
              document.querySelector<HTMLAnchorElement>('a[href="/reviews/"]')!.click();
            });
          },
          { once: true },
        );
      }),
  );
  await page.getByRole('link', { name: 'Listen', exact: true }).click();
  expect(await leftWhileBuilding).toBe(true);
  await page.waitForURL('/reviews/');
  await page.waitForFunction(() => document.title.endsWith('Reviews'));

  // Nothing from the half-built player turns up later, either.
  await page.waitForTimeout(1000);
  expect(await state(page)).toMatchObject({ path: '/reviews/', ...NO_PLAYER });
  expect(problems).toEqual([]);
});

test('leaving before Able Player has loaded', async ({ page }) => {
  const problems = await watch(page);
  // Hold back Able Player's script until the visitor has moved on.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/listen/ableplayer.js', async (route) => {
    await held;
    await route.continue();
  });

  await page.goto('/bios/');
  await follow(page, 'Listen');
  await follow(page, 'Reviews');
  release();
  await page.waitForFunction(() => (window as any).AblePlayer);
  await page.waitForTimeout(1000);
  expect(await state(page)).toMatchObject({ path: '/reviews/', ...NO_PLAYER });

  // The next visit still gets a player.
  await follow(page, 'Listen');
  await playerReady(page);
  expect(problems).toEqual([]);
});

// Safari won't play audio from a server that can't send part of a file when asked.
// Cloudflare can't by itself, so worker/index.ts does it for the MP3s.
test('the recordings can be fetched a piece at a time', async ({ request }) => {
  const mp3 = '/listen/doppler-excerpt.mp3';
  const whole = await request.get(mp3);
  expect(whole.headers()['accept-ranges']).toBe('bytes');
  const file = await whole.body();
  const size = file.length;

  const get = (range: string, headers = {}) => request.get(mp3, { headers: { Range: range, ...headers } });
  const expectPiece = async (response: APIResponse, start: number, end: number) => {
    expect(response.status()).toBe(206);
    expect(response.headers()['content-range']).toBe(`bytes ${start}-${end}/${size}`);
    expect((await response.body()).equals(file.subarray(start, end + 1))).toBe(true);
  };

  // Safari asks for the first two bytes before anything else, and Chrome for
  // everything from where it wants to start playing.
  await expectPiece(await get('bytes=0-1'), 0, 1);
  await expectPiece(await get('bytes=0-'), 0, size - 1);
  await expectPiece(await get('bytes=1000-'), 1000, size - 1);
  await expectPiece(await get(`bytes=1000-${size + 1000}`), 1000, size - 1);
  await expectPiece(await get('bytes=-500'), size - 500, size - 1);
  await expectPiece(await get('bytes=0-1', { 'If-Range': whole.headers().etag }), 0, 1);

  const pastTheEnd = await get(`bytes=${size}-`);
  expect(pastTheEnd.status()).toBe(416);
  expect(pastTheEnd.headers()['content-range']).toBe(`bytes */${size}`);

  // Anything else gets the whole file: several pieces at once, which the Worker
  // doesn't handle, or a piece of a copy of the file that has since changed.
  for (const response of [await get('bytes=0-1,5-6'), await get('bytes=0-1', { 'If-Range': '"older"' })]) {
    expect(response.status()).toBe(200);
    expect((await response.body()).equals(file)).toBe(true);
  }
});
