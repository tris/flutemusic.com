# flutemusic.com — Astro migration prototype

This is a complete static Astro port of the Jekyll site at commit `b9c4119`.
It preserves the existing design, content, payment integrations, public URLs,
and downloadable assets. Ruby, Bundler, Jekyll, and Liquid are no longer required.

## Run locally

Use Node.js 24 (`nvm use` if you use nvm):

```sh
npm ci
npm run dev
```

Open `http://localhost:4000`. Astro 7 starts its server in the background;
use `npm exec astro dev stop` to stop it. To check the actual deployable output:

```sh
npm run verify
npm exec astro dev stop
npm run preview
```

`verify` runs Astro's type checks, a production build, and 13 migration tests.
`dist/` is the complete static site. `make`, `make serve`, and `make install`
also use the Node toolchain. Stop preview with `npm exec astro preview stop`
before restarting development on the same port. In a sandbox without a writable user config
directory, set `ASTRO_TELEMETRY_DISABLED=1` when invoking Astro.

## Source layout

| Jekyll source | Astro source |
| --- | --- |
| `_layouts/default.html`, head/footer includes | `src/layouts/SiteLayout.astro` |
| Navigation include and `_data/nav.yaml` | `src/components/Navigation.astro`, `src/data/navigation.json` |
| Root HTML pages | `src/pages/` |
| `_posts/*.md` | `src/content/concerts/*.md`, validated by `src/content.config.ts` |
| Schedule's Liquid loops | `src/components/ConcertSchedule.astro` |
| Older schedule entries | `src/components/ConcertArchive.astro` |
| `events.json.html` | `src/pages/events.json.ts` |
| `redirect_from` frontmatter | `src/data/redirects.json`, `src/pages/[legacy].html.ts` |
| Images, CSS, recordings, downloads, domain files | `public/`, at the same public paths |

Seven historical payment pages keep their original HTML as trusted, local
fragments in `src/content/legacy/`, rendered inside the Astro layout. Their
malformed legacy HTML affects browser form ownership, so retaining the source
avoids changing which fields are submitted. The current `/payment/` page is
an Astro page. Existing rates, Stripe configuration, PayPal button IDs, and
the external payment handler are preserved.

## URL and content compatibility

- All **51 HTML files** are emitted at the same paths: 19 ordinary pages,
  24 distinct concert pages, and eight redirect documents.
- All **75 assets** are checked byte for byte, including MP3 files, the favicon,
  `CNAME`, and the Apple merchant domain association file.
- Astro's `build.format: 'preserve'` emits directory pages from `index.astro`
  and `.html` files from other page names. No server rewrite rules are needed.
- Redirect documents use an immediate meta refresh, a canonical URL, and a
  fallback link, so they work on GitHub Pages and ordinary static hosts.
- The calendar feed and schedule contain all **25 concerts**, newest first.
  Dates use `America/Los_Angeles`, with two-hour timed events and date-only
  all-day events. Future-dated concerts remain included.
- Individual concert URLs use the frontmatter date, not the filename date.
  The February 13 and February 14, 2015 source files historically both point
  to `/concerts/2015/02/14/beauty-and-the-beast.html`; both performances remain
  in the schedule/feed, and their identical page content is emitted once.
  A collision with different title/body content fails the build.

The deliberate output differences are valid HTML serialization, an English
language attribute, an accessible current-navigation indicator, safely encoded
calendar query parameters, literal ampersands in JSON event titles (instead of
HTML entities), a repaired archive map link, and a guard around the old analytics
callback when its script is unavailable. The merchant association file is now
explicitly published under `.well-known/` (Jekyll previously omitted it), while
the tracked Finder `.DS_Store` metadata is discarded. Page copy and the visual design stay
the same. Historical presentation attributes are narrowly declared in
`src/env.d.ts` for type checking.

## Editing concerts

Add Markdown to `src/content/concerts/` using a dated filename:

```yaml
---
title: Example concert
date: "2027-04-18 15:00"
location: Venue name, Santa Cruz, CA
category: concerts
---
Concert description with Markdown links.
```

Keep dates quoted. Use `"2027-04-18"` for an all-day event. Times are local to
Los Angeles, independent of the build machine's timezone. The next upcoming
concert's month is selected when the site is built; rebuild to update past/future
styling. The calendar otherwise opens on the viewer's current month, as before.

## Verification

The fixtures in `tests/fixtures/` were captured from the pre-migration Jekyll
output and original source asset bytes. Tests compare the emitted route inventory, asset hashes, page titles
and copy, payment form contracts, event ordering/times, Google Calendar links,
and local link targets. Date tests also cover daylight saving transitions and
year rollover. Typography/HTML entity differences are normalized where needed.
These are migration baselines: intentional later content changes need reviewed
fixture updates or replacement with ongoing content assertions.

The prototype was also exercised with Chromium/Playwright on the production
preview: all URLs, audio byte ranges, navigation/redirects, calendar month
navigation and historical events, playlist playback, and the payment amount
passed to a mocked checkout. Browser checks use the real existing calendar/audio
libraries; Stripe and analytics are intercepted. No real payment is submitted.

## Deployment and rollback

The CI workflow builds and verifies pushes and pull requests, then saves the
`astro-site` artifact. The **Deploy Astro to GitHub Pages** workflow automatically
deploys pushes to `gh-pages` and also supports manual runs. Switch existing branch-based Pages hosting before merging into its
publishing branch, so the old Jekyll pipeline does not publish unbuilt Astro sources.

For cutover:

1. Set repository **Settings → Pages → Source** to **GitHub Actions**, then merge
   the reviewed migration. Keep the custom domain `www.flutemusic.com` configured.
2. Merging into `gh-pages` starts **Deploy Astro to GitHub Pages** automatically.
   It rebuilds, verifies, and deploys `dist/`, including `.nojekyll` and `.well-known/`.
   Subsequent changes only require a commit and push to `gh-pages`.
3. Check the live domain, old `.html` redirects, `/events.json`, audio range
   requests, and payment provider integration. Real payment verification is
   separate from the local mocked checks.

To roll back, restore the pre-migration Jekyll revision and the previous Pages
branch deployment settings. The original source remains in Git history.

No GitHub Pages settings, DNS, or live deployment were changed for this prototype.
The existing fixed-width mobile layout, old third-party calendar/player libraries,
retired Urchin analytics integration, historical PayPal pages, and external Stripe
Checkout/CGI service remain separate modernization work. This migration does not
establish that the external payment service can complete a live transaction.
