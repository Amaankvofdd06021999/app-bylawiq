import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { logger } from '@/lib/logger';
import { secret } from '@/lib/env';
import { errorMessage } from '@/lib/errors';
import { launchFeatureEnabled } from '@/lib/launch-scope';

export async function POST(request: NextRequest) {
  // Payments are off for this release. Refuse before any secret is read or event is processed (lib/launch-scope.ts).
  if (!launchFeatureEnabled('payments')) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const webhookSecret = secret('STRIPE_WEBHOOK_SECRET');
  const stripe = new Stripe(secret('STRIPE_SECRET_KEY'));
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    logger.error({ context: 'stripe_webhook', error: 'Missing stripe-signature header' });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error({ context: 'stripe_webhook', error: errorMessage(err) });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type !== 'payment_intent.succeeded') {
    return NextResponse.json({ received: true });
  }

  const paymentIntent = event.data.object;
  try {
    await grantCredits(paymentIntent);
    return NextResponse.json({ received: true });
  } catch (err) {
    logger.error({
      context: 'stripe_webhook_grant',
      error: errorMessage(err),
    });
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}

async function grantCredits(paymentIntent: Stripe.PaymentIntent) {
  const { userId, buildingId, credits } = paymentIntent.metadata;
  if (!userId || !buildingId || !credits) {
    throw new Error('Payment is missing wallet metadata');
  }
  const amount = Number(credits);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Payment has an invalid credit amount');
  }

  const admin = createClient(secret('NEXT_PUBLIC_SUPABASE_URL'), secret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.rpc('add_wallet_credits', {
    p_user_id: userId,
    p_building_id: buildingId,
    p_amount: amount,
    p_stripe_tx_id: paymentIntent.id,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(`Credit grant failed: ${data?.error ?? 'unknown'}`);

  logger.info({
    context: 'stripe_webhook_grant',
    userId,
    buildingId,
    creditsAdded: amount,
    newBalance: data.new_balance,
  });
}
