// @ts-check
import { readFile, writeFile } from 'node:fs/promises';
import { defineConfig } from 'astro/config';
import { transform } from 'esbuild';

// public/listen/ableplayer.js is Able Player's unminified build. The site gets a
// minified copy at the same address.
function minifyAblePlayer() {
  return {
    name: 'minify-ableplayer',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        const file = new URL('listen/ableplayer.js', dir);
        const { code } = await transform(await readFile(file, 'utf8'), {
          minify: true,
          target: 'es2017',
          banner: '/*! ableplayer V3.2.0 */',
        });
        await writeFile(file, code);
      },
    },
  };
}

export default defineConfig({
  site: 'https://www.flutemusic.com',
  // Keep the pages' whitespace as written: the Jekyll site's spacing depends on it.
  compressHTML: false,
  build: {
    // Jekyll's addresses: bios/index.astro builds /bios/index.html, and samples.html
    // in [legacy].astro builds /samples.html.
    format: 'preserve',
    // Every page's CSS is small, so it goes in the page rather than a separate request.
    inlineStylesheets: 'always',
  },
  integrations: [minifyAblePlayer()],
});
