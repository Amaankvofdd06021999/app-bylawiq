'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { SendResidentMessageSchema, SpendCreditSchema } from './resident-chat-schema';

/**
 * Get resident chat state (credits, free questions used)
 */
export async function getResidentChatStateAction(buildingId: string) {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Verify user is a resident of this building
    const { data: resident, error: residentError } = await db
      .from('building_members')
      .select('id, role')
      .eq('building_id', buildingId)
      .eq('user_id', user.id)
      .eq('role', 'owner_resident')
      .single();

    if (residentError || !resident) {
      throw new ForbiddenError('You are not a resident of this building');
    }

    // Get wallet
    const { data: wallet, error: walletError } = await db
      .from('resident_wallets')
      .select('credits, free_questions_used')
      .eq('user_id', user.id)
      .eq('building_id', buildingId)
      .single();

    if (walletError) {
      // Create wallet if doesn't exist
      const { data: newWallet, error: createError } = await db
        .from('resident_wallets')
        .insert({
          user_id: user.id,
          building_id: buildingId,
          credits: 0,
          free_questions_used: 0,
        })
        .select()
        .single();

      checkDb(createError);

      return {
        ok: true,
        state: {
          building_id: buildingId,
          user_id: user.id,
          free_questions_used: 0,
          credits: 0,
          total_credits: 0,
        },
      };
    }

    return {
      ok: true,
      state: {
        building_id: buildingId,
        user_id: user.id,
        free_questions_used: wallet.free_questions_used,
        credits: wallet.credits,
        total_credits: wallet.credits,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Spend credit for a resident action (question, draft, reply)
 * Returns: 'free' | 'credits' | 'paywall'
 */
export async function spendCreditAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SpendCreditSchema.parse(raw);

    const db = await createClient();

    // Verify user is a resident
    const { data: resident, error: residentError } = await db
      .from('building_members')
      .select('id')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .eq('role', 'owner_resident')
      .single();

    if (residentError || !resident) {
      throw new ForbiddenError('You are not a resident of this building');
    }

    // Get wallet
    const { data: wallet, error: walletError } = await db
      .from('resident_wallets')
      .select('credits, free_questions_used')
      .eq('user_id', user.id)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(walletError);

    // Define costs
    const costs: Record<string, number> = {
      question: 1,
      draft_notice: 5,
      email_reply: 3,
    };

    const cost = costs[input.action] || 1;
    const freeQuestionsLimit = 2;

    let outcome: 'free' | 'credits' | 'paywall' = 'paywall';

    // If it's a question and they have free questions, use that
    if (input.action === 'question') {
      if (wallet.free_questions_used < freeQuestionsLimit) {
        outcome = 'free';
        // Update free questions used
        await db
          .from('resident_wallets')
          .update({ free_questions_used: wallet.free_questions_used + 1 })
          .eq('user_id', user.id)
          .eq('building_id', input.buildingId);
      } else if (wallet.credits >= cost) {
        outcome = 'credits';
        // Deduct credits
        await db
          .from('resident_wallets')
          .update({ credits: wallet.credits - cost })
          .eq('user_id', user.id)
          .eq('building_id', input.buildingId);
      } else {
        outcome = 'paywall';
      }
    } else {
      // Drafts and replies always cost credits
      if (wallet.credits >= cost) {
        outcome = 'credits';
        await db
          .from('resident_wallets')
          .update({ credits: wallet.credits - cost })
          .eq('user_id', user.id)
          .eq('building_id', input.buildingId);
      } else {
        outcome = 'paywall';
      }
    }

    // Log the ledger entry
    if (outcome !== 'paywall') {
      const reason =
        outcome === 'free'
          ? 'free_question'
          : input.action === 'question'
            ? 'question'
            : input.action === 'draft_notice'
              ? 'draft_notice'
              : 'email_reply';

      const delta = outcome === 'free' ? 0 : -cost;

      await db.from('credit_ledger').insert({
        user_id: user.id,
        building_id: input.buildingId,
        delta,
        reason,
        chat_run_id: input.chatRunId || null,
      });
    }

    return {
      ok: true,
      outcome,
      costDeducted: outcome === 'paywall' ? 0 : outcome === 'free' ? 0 : cost,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Purchase credit pack - real checkout with wallet update
 * Adds credits to resident wallet and logs transaction
 */
export async function purchaseCreditsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        buildingId: z.string().uuid(),
        creditAmount: z.number().int().positive(),
      })
      .parse(raw);

    const db = await createClient();

    // Verify user is a resident
    const { data: resident, error: residentError } = await db
      .from('building_members')
      .select('id')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .eq('role', 'owner_resident')
      .single();

    if (residentError || !resident) {
      throw new ForbiddenError('You are not a resident of this building');
    }

    // Get wallet
    const { data: wallet, error: walletError } = await db
      .from('resident_wallets')
      .select('credits')
      .eq('user_id', user.id)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(walletError);

    // Add credits
    await db
      .from('resident_wallets')
      .update({ credits: wallet.credits + input.creditAmount })
      .eq('user_id', user.id)
      .eq('building_id', input.buildingId);

    // Log purchase
    await db.from('credit_ledger').insert({
      user_id: user.id,
      building_id: input.buildingId,
      delta: input.creditAmount,
      reason: 'purchase',
    });

    return {
      ok: true,
      newBalance: wallet.credits + input.creditAmount,
      message: `Added ${input.creditAmount} credits`,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
