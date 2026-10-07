import 'server-only';
import { json } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import type Stripe from 'stripe';

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Stripe webhook handler for payment.intent.succeeded events
// Adds credits to resident wallet and logs transaction
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature || !webhookSecret) {
    logger.error({ requestId: 'stripe-webhook', error: 'Missing signature or webhook secret' });
    return json({ error: 'Webhook configuration error' }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    logger.error({ requestId: 'stripe-webhook', error: err.message });
    return json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle payment.intent.succeeded event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    try {
      await handlePaymentSucceeded(paymentIntent);
      return json({ received: true });
    } catch (err: any) {
      logger.error({
        requestId: `stripe-webhook-${paymentIntent.id}`,
        error: err.message,
        paymentIntentId: paymentIntent.id,
      });
      return json({ error: 'Failed to process payment' }, { status: 500 });
    }
  }

  // Silently ignore other events
  return json({ received: true });
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // Metadata structure: { userId, buildingId, credits, reason }
  const metadata = paymentIntent.metadata || {};
  const { userId, buildingId, credits } = metadata;

  if (!userId || !buildingId || !credits) {
    throw new Error(`Missing required metadata: userId=${userId}, buildingId=${buildingId}, credits=${credits}`);
  }

  const numCredits = parseInt(credits, 10);
  if (isNaN(numCredits) || numCredits <= 0) {
    throw new Error(`Invalid credits amount: ${credits}`);
  }

  // Initialize Supabase admin client to call the RPC function
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  // Call add_wallet_credits RPC function
  const { data, error } = await supabase.rpc('add_wallet_credits', {
    p_user_id: userId,
    p_building_id: buildingId,
    p_amount: numCredits,
    p_stripe_tx_id: paymentIntent.id,
  });

  if (error) {
    logger.error({
      requestId: `stripe-webhook-${paymentIntent.id}`,
      userId,
      buildingId,
      error: error.message,
    });
    throw error;
  }

  if (!data?.success) {
    throw new Error(`Failed to add wallet credits: ${data?.error}`);
  }

  logger.info({
    requestId: `stripe-webhook-${paymentIntent.id}`,
    userId,
    buildingId,
    creditsAdded: numCredits,
    newBalance: data.new_balance,
  });
}
