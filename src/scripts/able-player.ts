// Able Player on /listen/, started on every visit to the page and taken down when
// the visitor moves on.
//
// Able Player expects a full page load for every page. It starts its players once,
// when the page has loaded, and it adds handlers to window and document that it never
// removes. The client router swaps pages without reloading, so:
//
// - The <audio> element is marked data-able-player-deferred instead of
//   data-able-player, which Able Player's own start-up code looks for, and the player
//   is started here each time the page is shown.
// - Before the page is swapped out, playback stops, the handlers the player added
//   to window and document come off, and Able Player's count of players goes back to
//   zero. While there is exactly one player, Able Player sends it every key pressed
//   anywhere on the page, so a leftover player would start playing when someone
//   pressed the space bar on another page.
// - A player takes a moment to build itself, in several steps. Leaving the page
//   waits for the last step, so that nothing is added to a page after it's gone.
import jqueryUrl from '../vendor/jquery-3.2.1.min.js?url';
import { loadScripts } from './load-script';

const ROOT = '/listen/';
const TRANSLATION = `${ROOT}translations/en.js`;
const SCRIPTS = [jqueryUrl, `${ROOT}js.cookie.js`, `${ROOT}ableplayer.js`, TRANSLATION];

// The longest leaving the page will wait for a player to finish building itself.
// Building takes a few milliseconds once the scripts are loaded, so this only
// matters if something went wrong.
const STARTUP_WAIT = 1000;

interface AblePlayer {
  media: HTMLMediaElement;
  // True while the player is building itself, false once it's done.
  initializing?: boolean;
}

type JQueryHandler = { origType: string; selector?: string; handler: () => void };

// Able Player and jQuery are classic scripts, so they're globals.
const globals = () => window as unknown as { jQuery: any; AblePlayer: any };

let players: AblePlayer[] = [];
// The jQuery handlers on window and document from before the players started.
let handlersBefore = new Set<JQueryHandler>();

function jQueryHandlers(): Map<EventTarget, JQueryHandler[]> {
  const { jQuery: $ } = globals();
  return new Map(
    [window, document].map((target) => [
      target,
      Object.values<JQueryHandler[]>($._data(target, 'events') ?? {}).flat(),
    ]),
  );
}

let patched = false;
function patchAblePlayer() {
  if (patched) return;
  patched = true;
  const { jQuery: $, AblePlayer } = globals();
  // Able Player downloads its translation file itself, bypassing the browser's cache,
  // every time a player starts. It's loaded once with the other scripts instead.
  AblePlayer.prototype.importTranslationFile = (file: string) =>
    $.Deferred((deferred: any) => {
      loadScripts([file]).then(() => deferred.resolve(), () => deferred.reject());
    }).promise();
}

document.addEventListener('astro:page-load', async () => {
  const media = [...document.querySelectorAll<HTMLMediaElement>('[data-able-player-deferred]')];
  if (media.length === 0) return;
  await loadScripts(SCRIPTS);
  // The visitor may have moved on while the scripts were loading.
  if (!media.every((el) => el.isConnected)) return;

  const { jQuery: $, AblePlayer } = globals();
  patchAblePlayer();
  handlersBefore = new Set([...jQueryHandlers().values()].flat());
  players = media.map((el) => new AblePlayer($(el)));
});

document.addEventListener('astro:before-preparation', (event) => {
  if (!players.some((player) => player.initializing !== false)) return;
  const loadPage = event.loader;
  event.loader = async () => {
    await Promise.all([loadPage(), playersStarted()]);
  };
});

async function playersStarted() {
  const giveUp = performance.now() + STARTUP_WAIT;
  while (players.some((player) => player.initializing !== false) && performance.now() < giveUp) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

document.addEventListener('astro:before-swap', () => {
  if (players.length === 0) return;
  const { jQuery: $, AblePlayer } = globals();

  for (const { media } of players) {
    media.pause();
    // Stop downloading the track, too.
    for (const source of media.querySelectorAll('source')) source.remove();
    media.removeAttribute('src');
    media.load();
  }

  for (const [target, handlers] of jQueryHandlers()) {
    for (const { origType, selector, handler } of handlers.filter((h) => !handlersBefore.has(h))) {
      $(target).off(origType, selector, handler);
    }
  }

  AblePlayer.nextIndex = 0;
  AblePlayer.lastCreated = undefined;
  players = [];
  handlersBefore = new Set();
});
