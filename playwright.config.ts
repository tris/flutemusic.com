import { defineConfig, devices } from '@playwright/test';

// Browser tests for the parts of the site that run scripts: Able Player on /listen/
// across client-side page changes, the schedule calendar, and the payment button.
// They run against the built site, served the way Cloudflare serves it:
// npm run build && npm test
export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:8787',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // npm run preview: Wrangler serves the build the way Cloudflare does, with its
    // redirects and headers and the Worker for the MP3s.
    command: 'npx wrangler dev',
    url: 'http://localhost:8787',
    reuseExistingServer: !process.env.CI,
    env: { WRANGLER_SEND_METRICS: 'false' },
  },
});
