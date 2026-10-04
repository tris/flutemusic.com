import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.flutemusic.com',
  output: 'static',
  server: { host: true, port: 4000 },
  // index.astro -> /name/index.html; name.astro -> /name.html.
  build: { format: 'preserve' },
});
