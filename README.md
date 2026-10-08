# flutemusic.com

Kathleen Purcell Flute Studios' website, built with [Astro](https://astro.build) and
served by [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).
Pushing to `gh-pages` builds it, runs the browser tests and publishes it to
Cloudflare (`.github/workflows/site.yml`).

```sh
npm install
npm run dev      # http://localhost:4321, reloading as you edit
npm run build    # the finished site, in dist/
npm run preview  # dist/ served the way Cloudflare serves it, at http://localhost:8787
npm test         # browser tests against that (once: npx playwright install chromium)
```

## Where things are

- `src/pages/`: one file per page. `[legacy].astro` publishes the old pages in
  `src/legacy/` at their old addresses.
- `src/content/concerts/`: one Markdown file per concert, listed on the Concert
  Schedule and in the calendar (`/events.json`).
- `public/`: published as is, at the same address. The `.avif` files are smaller
  copies of the photos beside them; run `npm run avif` after replacing one of those
  photos. `_redirects` sends the old `.html` addresses to the new ones, `_headers`
  lets browsers keep Astro's files for a year, and `.assetsignore` leaves out the one
  recording too big for Cloudflare.
- `src/scripts/`: Able Player on Listen, the calendar on Concert Schedule and Stripe
  Checkout on Payment.
- `worker/index.ts`: the site's one piece of server code, which sends the MP3s a
  piece at a time so that Safari can play them. `wrangler.jsonc` sends requests for
  MP3s there; Cloudflare serves everything else from `dist/` itself.

## Moving between pages

Astro's client router (`<ClientRouter />` in `src/layouts/Default.astro`) swaps
pages in place instead of loading each one afresh, so a script runs once per visit,
not once per page. The scripts in `src/scripts/` start their widget on every
`astro:page-load` and take it down on `astro:before-swap`. Payment, the concert
pages and the old pages leave the router out, so links to them load the page afresh.
