'use server';
import { z } from 'zod';
import Stripe from 'stripe';
import { requireUser } from '@/lib/auth/guards';
import { AppError, ForbiddenError, checkDb, errorMessage } from '@/lib/errors';
import { appUrl, secret } from '@/lib/env';
import { logger } from '@/lib/logger';
import { requireLaunchFeature } from '@/lib/launch-scope';
import { CREDIT_PACK } from './pricing';

const CheckoutInput = z.object({ buildingId: z.uuid() });

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function createCreditCheckoutAction(raw: unknown): Promise<CheckoutResult> {
  try {
    // Payments are off for this release. Refused before the caller is read and before any Stripe call (lib/launch-scope.ts).
    requireLaunchFeature('payments');
    const user = await requireUser();
    const input = CheckoutInput.parse(raw);

    const { data: member, error } = await user.client
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    checkDb(error);
    if (member?.role !== 'owner_resident') {
      throw new ForbiddenError('Only residents of this building can buy credits here.');
    }

    // Say plainly that nothing was charged: the generic "service not connected" message reads as if work was lost.
    if (!process.env.STRIPE_SECRET_KEY)
      throw new AppError(
        'payments_unavailable',
        'Card payments aren’t set up for this building yet. You have not been charged.',
        503,
      );
    const stripe = new Stripe(secret('STRIPE_SECRET_KEY'));
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: CREDIT_PACK.currency,
            unit_amount: CREDIT_PACK.priceCents,
            product_data: { name: `${CREDIT_PACK.credits} BylawIQ credits` },
          },
        },
      ],
      payment_intent_data: {
        metadata: {
          userId: user.id,
          buildingId: input.buildingId,
          credits: String(CREDIT_PACK.credits),
          reason: 'credit_pack',
        },
      },
      success_url: `${appUrl()}/b/${input.buildingId}/home?credits=added`,
      cancel_url: `${appUrl()}/b/${input.buildingId}/home?credits=cancelled`,
    });
    if (!session.url) throw new Error('Stripe returned no checkout URL');

    return { ok: true, url: session.url };
  } catch (e) {
    logger.error({ context: 'credit_checkout', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}
