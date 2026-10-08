import { expect, test, type Page } from '@playwright/test';
import { FAKE_CHECKOUT, follow, playerReady, watch } from './helpers';

async function fakePayments(page: Page) {
  const posted: string[] = [];
  await page.route('https://tris.net/**', async (route) => {
    posted.push(route.request().postData() ?? '');
    await route.fulfill({ contentType: 'text/html', body: '<p>Paid (test)</p>' });
  });
  return posted;
}

test('Pay with Card sends the amount and card token to the charging script', async ({ page }) => {
  const problems = await watch(page);
  const posted = await fakePayments(page);
  await page.route('https://checkout.stripe.com/checkout.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: FAKE_CHECKOUT }),
  );

  await page.goto('/payment/');
  await page.locator('#dollars').selectOption({ label: '3 Weeks of 45 Minute Lessons $216.00' });
  await page.getByRole('button', { name: 'Pay with Card' }).click();

  expect(await page.evaluate(() => (window as any).checkout)).toMatchObject({
    options: { key: 'pk_live_8I5dx0CoZRIg4mNkPZjGNsVi', locale: 'auto', name: 'Purcell Flute Studios', description: 'Flute Lessons', bitcoin: false },
    opened: { amount: 21600 },
  });
  expect(problems).toEqual([]);

  await page.evaluate(() => (window as any).checkout.pay());
  await expect.poll(() => posted).toEqual(['token=tok_test&amount=21600&description=Flute+Lessons']);
});

test('a click before the scripts have loaded posts nothing', async ({ page }) => {
  const posted = await fakePayments(page);
  // Hold back the page's own script and Stripe's.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/_astro/*.js', async (route) => {
    await held;
    await route.continue();
  });
  await page.route('https://checkout.stripe.com/checkout.js', async (route) => {
    await held;
    await route.fulfill({ contentType: 'application/javascript', body: FAKE_CHECKOUT });
  });

  // Both DOMContentLoaded and the load event wait for the scripts.
  await page.goto('/payment/', { waitUntil: 'commit' });
  const pay = page.getByRole('button', { name: 'Pay with Card' });
  await pay.click();
  await page.waitForTimeout(500);
  expect(posted).toEqual([]);
  await expect(page).toHaveURL('/payment/');

  // Once they've loaded, the button opens Checkout.
  release();
  await page.waitForFunction(() => (window as any).checkout);
  await pay.click();
  expect(await page.evaluate(() => (window as any).checkout.opened)).toEqual({ amount: 9600 });
  expect(posted).toEqual([]);
});

test('the payment page always loads afresh', async ({ page }) => {
  await page.route('https://checkout.stripe.com/checkout.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: FAKE_CHECKOUT }),
  );
  await watch(page);
  await page.goto('/listen/');
  await playerReady(page);
  await page.evaluate(() => ((window as any).sameDocument = true));

  await page.getByRole('link', { name: 'Payment', exact: true }).click();
  await page.waitForURL('**/payment/');
  await page.waitForFunction(() => (window as any).checkout);
  expect(await page.evaluate(() => (window as any).sameDocument)).toBeUndefined();

  // And back to a page with the client router.
  await page.getByRole('link', { name: 'Listen', exact: true }).click();
  await page.waitForURL('**/listen/');
  await playerReady(page);
  await follow(page, 'Biography');
});
