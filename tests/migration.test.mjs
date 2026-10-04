import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/jekyll-${name}.json`, import.meta.url)));
const output = (path) => new URL(`../dist${path}`, import.meta.url);
const html = (path) => readFileSync(output(path), 'utf8');
const routes = fixture('routes');
const pages = fixture('pages');
// Markdown engines differ in smart punctuation and whitespace, not in copy.
const normalize = (text) => text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '--').replace(/\s+/g, '');

test('every Jekyll HTML URL is emitted as the same file, without extra HTML routes', () => {
  const generated = readdirSync(output('/'), { recursive: true })
    .filter((path) => path.endsWith('.html')).map((path) => `/${path}`).sort();
  assert.deepEqual(generated, routes);
});

test('all original assets, including audio, domain verification, and favicon, are byte-identical', () => {
  for (const [path, hash] of Object.entries(fixture('assets'))) {
    assert.equal(createHash('sha256').update(readFileSync(output(path))).digest('hex'), hash, path);
  }
  assert.ok(existsSync(output('/.nojekyll')));
});

test('every content page preserves its title and visible copy', () => {
  for (const [path, expected] of Object.entries(pages)) {
    const $ = load(html(path));
    $('script,style').remove();
    assert.equal($('title').text(), expected.title, `${path} title`);
    assert.equal(normalize($('body').text()), normalize(expected.text), `${path} copy`);
  }
});

test('legacy redirects retain their destinations and work as static HTML', () => {
  for (const path of routes.filter((path) => !pages[path])) {
    const $ = load(html(path));
    const destination = `${path.slice(0, -5)}/`;
    assert.equal($('meta[http-equiv="refresh"]').attr('content'), `0; url=${destination}`);
    assert.equal($('link[rel="canonical"]').attr('href'), `https://www.flutemusic.com${destination}`);
    assert.equal($('a').attr('href'), destination);
    assert.ok(existsSync(output(`${destination}index.html`)));
  }
});

test('all 25 calendar entries retain ordering, local times, and durations', () => {
  // The old feed HTML-escaped ampersands in JSON. The new feed uses literal text.
  const expected = fixture('events').map((event) => ({ ...event, title: load(event.title, null, false).text() }));
  assert.deepEqual(JSON.parse(html('/events.json')), expected);
  const $ = load(html('/schedule/index.html'));
  assert.equal($('#calendar').length, 1);
  assert.equal($('body > ul > li').length, 25);
  assert.equal($('a[href*="calendar/render"]').length, 24);
  const links = fixture('calendar-links');
  for (const [index, anchor] of $('a[href*="calendar/render"]').toArray().entries()) {
    const url = new URL($(anchor).attr('href'));
    for (const [key, value] of Object.entries(links[index])) {
      const canonical = (text) => normalize(key === 'details' ? load(text, null, false).html() : text);
      assert.equal(canonical(url.searchParams.get(key)), canonical(value), `${index} ${key}`);
    }
  }
});

test('payment destinations, hosted button IDs, rates, and form fields are unchanged', () => {
  for (const [path, expected] of Object.entries(pages)) {
    if (!expected.forms.length) continue;
    const $ = load(html(path));
    const forms = $('form').toArray().map((element) => ({
      action: $(element).attr('action'),
      method: $(element).attr('method')?.toLowerCase(),
      target: $(element).attr('target') ?? null,
      inputs: $(element).find('input').toArray().map((input) => ({
        name: $(input).attr('name') ?? null,
        type: $(input).attr('type'),
        value: $(input).attr('value') ?? null,
      })),
      options: $(element).find('option').toArray().map((option) => ({
        value: $(option).attr('value'), text: $(option).text(), selected: $(option).is('[selected]'),
      })),
    }));
    assert.deepEqual(forms, expected.forms, path);
  }
});

test('local links, images, stylesheets, scripts, and playlist sources resolve on a plain static host', () => {
  const broken = [];
  for (const path of Object.keys(pages)) {
    const $ = load(html(path));
    const base = `https://www.flutemusic.com${path.replace(/index\.html$/, '')}`;
    for (const [selector, attribute] of [['a[href]', 'href'], ['img[src],script[src],input[src]', 'src'], ['link[href]', 'href'], ['[data-mp3]', 'data-mp3']]) {
      for (const element of $(selector).toArray()) {
        const value = $(element).attr(attribute);
        const url = new URL(value, base);
        if (!['http:', 'https:'].includes(url.protocol) || !['www.flutemusic.com', 'flutemusic.com'].includes(url.hostname)) continue;
        const target = output(decodeURI(url.pathname));
        const file = existsSync(target) && (statSync(target).isFile() || existsSync(new URL(`${target.href.replace(/\/$/, '')}/index.html`)));
        if (!file) broken.push(`${path}: ${value} -> ${url.pathname}`);
      }
    }
    assert.doesNotMatch(html(path), /\{%|\{\{\s*(?:site|page|post)\./, `${path} contains Liquid`);
  }
  assert.deepEqual(broken, []);
});
