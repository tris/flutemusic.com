import { expect, test } from '@playwright/test';
import { FAKE_CHECKOUT, watch } from './helpers';

const PAGES = [
  '/', '/bios/', '/reviews/', '/listen/', '/schedule/', '/lessons/', '/payment/', '/press/', '/thankyou/',
  '/samples.html', '/concert-bio.html', '/concerts/2019/05/05/benefit-concert.html',
];

for (const path of PAGES) {
  test(`${path} loads without errors`, async ({ page }) => {
    const problems = await watch(page);
    // Keep the payment page from reaching Stripe.
    await page.route('https://checkout.stripe.com/checkout.js', (route) =>
      route.fulfill({ contentType: 'application/javascript', body: FAKE_CHECKOUT }),
    );
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });
}

// The main pages' old addresses, which jekyll-redirect-from sent on to the new ones.
const OLD_ADDRESSES = ['bios', 'reviews', 'listen', 'schedule', 'lessons', 'payment', 'press', 'thankyou'];

test('the old .html addresses redirect to the new ones', async ({ request }) => {
  for (const name of OLD_ADDRESSES) {
    const response = await request.get(`/${name}.html`, { maxRedirects: 0 });
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe(`/${name}/`);
  }
});

test("Astro's files are cached for a year", async ({ request }) => {
  // Each is named after its contents, so a changed file gets a new name.
  const html = await (await request.get('/')).text();
  const script = html.match(/src="(\/_astro\/[^"]+)"/)![1];
  expect((await request.get(script)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
});
