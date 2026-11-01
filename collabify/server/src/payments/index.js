import { config } from '../config.js';
import { mockProvider } from './mock.js';
import { createStripeProvider } from './stripe.js';

export function getPaymentProvider() {
  if (config.paymentProvider === 'stripe') {
    if (!config.stripeSecretKey) throw new Error('PAYMENT_PROVIDER=stripe requires STRIPE_SECRET_KEY');
    return createStripeProvider(config.stripeSecretKey, config.currency);
  }
  return mockProvider;
}
