import { expect, type Page } from '@playwright/test';

// Records page errors and console errors, and adds two things to every page before
// the site's own scripts run: a count of the client router's page changes, and a
// list of every audio or video element asked to play. Client-side page changes keep
// the same document, so both last across them.
export async function watch(page: Page): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(message.text());
  });
  await page.addInitScript(() => {
    const w = window as any;
    w.pageChanges = 0;
    document.addEventListener('astro:page-load', () => w.pageChanges++);
    // Weak references, so that the list doesn't keep old pages alive. A playing
    // element is never collected, so none goes missing from the list.
    w.played = new Set<WeakRef<HTMLMediaElement>>();
    const listed = new WeakSet<HTMLMediaElement>();
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (!listed.has(this)) {
        listed.add(this);
        w.played.add(new WeakRef(this));
      }
      return play.call(this);
    };
  });
  return problems;
}

async function afterPageChange(page: Page, change: () => Promise<unknown>) {
  const before = await page.evaluate(() => (window as any).pageChanges);
  await change();
  await page.waitForFunction((n) => (window as any).pageChanges > n, before);
}

// Clicks a link and waits for the client router to show the new page.
export const follow = (page: Page, link: string) =>
  afterPageChange(page, () => page.getByRole('link', { name: link, exact: true }).click());

export const back = (page: Page) => afterPageChange(page, () => page.goBack());
export const forward = (page: Page) => afterPageChange(page, () => page.goForward());

// Waits for the one player on /listen/ to finish building itself.
export async function playerReady(page: Page) {
  await page.waitForFunction(() => {
    const { AblePlayer } = window as any;
    return AblePlayer?.nextIndex === 1 && AblePlayer.lastCreated?.initializing === false;
  });
  await expect(page.locator('.able-wrapper')).toHaveCount(1);
}

export interface PageState {
  path: string;
  // Able Player's own elements, anywhere in the page.
  ableElements: number;
  players: number;
  // Able Player's count of players; it sends key presses to the player while it's 1.
  nextIndex: number | undefined;
  // jQuery handlers on window and document.
  windowHandlers: number;
  documentHandlers: number;
  playing: number;
  playingOffPage: number;
}

export function state(page: Page): Promise<PageState> {
  return page.evaluate(() => {
    const w = window as any;
    const handlers = (target: EventTarget) =>
      w.jQuery ? Object.values<unknown[]>(w.jQuery._data(target, 'events') ?? {}).reduce((n, list) => n + list.length, 0) : 0;
    const playing = [...w.played]
      .map((ref: WeakRef<HTMLMediaElement>) => ref.deref())
      .filter((media?: HTMLMediaElement) => media && !media.paused);
    return {
      path: location.pathname,
      ableElements: document.querySelectorAll('[class*="able-"]').length,
      players: document.querySelectorAll('.able-wrapper').length,
      nextIndex: w.AblePlayer?.nextIndex,
      windowHandlers: handlers(window),
      documentHandlers: handlers(document),
      playing: playing.length,
      playingOffPage: playing.filter((media: HTMLMediaElement) => !media.isConnected).length,
    };
  });
}

// The state of a page without a player. Once Able Player's script has loaded, it
// keeps one key handler on window for good. It only acts while there's exactly one
// player.
export const NO_PLAYER = { ableElements: 0, players: 0, nextIndex: 0, windowHandlers: 1, documentHandlers: 0, playing: 0 };

// Stands in for Stripe's checkout.js. checkout.pay() plays the part of the visitor
// entering a card, and hands back a test token. Nothing here talks to Stripe or to
// the charging script on tris.net.
export const FAKE_CHECKOUT = `
  window.StripeCheckout = {
    configure(options) {
      window.checkout = { options, pay: () => options.token({ id: 'tok_test' }) };
      return {
        open(details) { window.checkout.opened = details; },
        close() {},
      };
    },
  };
`;
