// "Pay with Card" on /payment/ opens Stripe's legacy Checkout for the lessons picked.
// Checkout hands back a card token, which is posted with the amount to the script on
// tris.net that makes the charge. The button is type="button", so a click never posts
// the form by itself, even before this script or Checkout has loaded.
import { loadScripts } from './load-script';

interface CheckoutHandler {
  open(options: { amount: number }): void;
  close(): void;
}

declare const StripeCheckout: {
  configure(options: Record<string, unknown>): CheckoutHandler;
};

const form = document.querySelector('form')!;
const field = (id: string) => document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
let handler: CheckoutHandler | undefined;

function showError(html: string) {
  const explanation = document.getElementById('error_explanation');
  if (explanation) explanation.innerHTML = html;
}

loadScripts(['https://checkout.stripe.com/checkout.js']).then(() => {
  handler = StripeCheckout.configure({
    key: 'pk_live_8I5dx0CoZRIg4mNkPZjGNsVi',
    locale: 'auto',
    name: 'Purcell Flute Studios',
    description: 'Flute Lessons',
    bitcoin: false,
    token(token: { id: string }) {
      field('token').value = token.id;
      form.submit();
    },
  });
});

document.getElementById('paymentButton')!.addEventListener('click', () => {
  // Until Checkout has loaded there's nothing to open.
  if (!handler) return;

  showError('');

  let amount = parseFloat(field('dollars').value.replace(/\$/g, '').replace(/,/g, ''));

  if (isNaN(amount)) {
    showError('<p>Please enter a valid amount in USD ($).</p>');
  } else if (amount < 5.0) {
    showError('<p>Payment amount must be at least $5.</p>');
  } else {
    amount = amount * 100; // Needs to be an integer!
    field('amount').value = String(amount);
    handler.open({
      amount: Math.round(amount),
    });
  }
});

// Close Checkout on page navigation
window.addEventListener('popstate', () => handler?.close());
