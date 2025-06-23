import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  price1m: process.env.PRICE_1M,
  price6m: process.env.PRICE_6M,
  price12m: process.env.PRICE_12M,
}));
