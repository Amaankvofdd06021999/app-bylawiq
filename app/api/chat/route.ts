import { after } from 'next/server';
import { z } from 'zod';
import { requireUser, requirePermission, type SessionUser } from '@/lib/auth/guards';
import { sameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { checkDb, errorResponse, NotFoundError, RateLimitError } from '@/lib/errors';
import { requireLaunchFeature } from '@/lib/launch-scope';
import { chatSchema } from '@/lib/schema';
import { generateAnswer, replayStream } from '@/features/chat/stream';
import { auditRateLimit } from '@/features/chat/resident-verification-gate';
import { logger } from '@/lib/logger';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    // Off for launch: refuse before the body is read or any data is loaded (lib/launch-scope.ts).
    requireLaunchFeature('answers');
    sameOrigin(req);
    const v = z
      .object({
        id: z.uuid(),
        message: z.object({
          id: z.uuid(),
          role: z.literal('user'),
          parts: z
            .array(z.object({ type: z.literal('text'), text: z.string().min(1).max(20000) }))
            .min(1)
            .max(1),
        }),
        layers: z.array(z.enum(['building', 'firm', 'legal', 'staff', 'financial'])).optional(),
      })
      .parse(await req.json());
    const { data, error } = await user.client
      .from('chats')
      .select('id,building_id,user_id,title,scope,scope_building_ids,as_of,source_types,agent_deployment_id')
      .eq('id', v.id)
      .single();
    if (error || !data) throw new NotFoundError();
    const chat = chatSchema.parse(data);
    if (chat.building_id) await requirePermission(user, 'chat.use', chat.building_id);
    const prior = await user.client
      .from('chat_runs')
      .select('id')
      .eq('request_id', v.message.id)
      .eq('chat_id', chat.id)
      .maybeSingle();
    if (prior.data) return replayStream(user, prior.data.id, req.signal);
    try {
      await rateLimit(user.id);
    } catch (e) {
      // Record the hit for building chats (doc 11 audit trail). The request is still refused.
      if (chat.building_id && e instanceof RateLimitError) {
        await auditRateLimit({
          userId: user.id,
          buildingId: chat.building_id,
          limitType: 'minute',
          attemptedAt: new Date().toISOString(),
        });
      }
      throw e;
    }
    const history = await user.client
      .from('messages')
      .select('role,parts')
      .eq('chat_id', chat.id)
      .order('created_at');
    checkDb(history.error);
    const run = await user.client
      .from('chat_runs')
      .insert({ chat_id: chat.id, request_id: v.message.id })
      .select('id')
      .single();
    checkDb(run.error);
    if (!run.data) throw new NotFoundError();
    checkDb(
      (
        await user.client
          .from('messages')
          .insert({ id: v.message.id, chat_id: chat.id, role: 'user', parts: v.message.parts })
      ).error,
    );
    const priorMessages = z
      .array(
        z.object({
          role: z.enum(['user', 'assistant']),
          parts: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()),
        }),
      )
      .parse(history.data)
      .map((m) => ({
        role: m.role,
        text: m.parts
          .filter((p) => p.type === 'text')
          .map((p) => p.text || '')
          .join('\n'),
      }));
    if (!run.data) throw new NotFoundError();
    const runId = run.data.id;
    const work = generateAnswer(user, chat, runId, v.message.parts[0].text, priorMessages, v.layers);
    after(async () => {
      const outcome = await work;
      // Deduct wallet credits after chat completes ONLY if a verified grounded answer was produced (residents only)
      if (chat.building_id && outcome?.grounded) {
        await deductChatCredits(user, chat.id, chat.building_id, outcome.tokens);
      }
    });
    return replayStream(user, runId, req.signal);
  } catch (e) {
    return errorResponse(e);
  }
}

// Deduct credits from resident wallet after chat completes
// Cost: 1 credit per 1000 tokens (approximately $0.01 per 1000 tokens)
async function deductChatCredits(user: SessionUser, chatId: string, buildingId: string, tokens?: number) {
  try {
    // Check if user is a resident (has owner_resident role)
    const { data: member, error: memberError } = await user.client
      .from('building_members')
      .select('role')
      .eq('building_id', buildingId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    checkDb(memberError);

    // Only residents pay for chats
    if (!member || member.role !== 'owner_resident') {
      return;
    }

    const tokenCount = tokens && tokens > 0 ? tokens : Math.max(500, Math.ceil((prompt.length + 1500) / 4));
    // Cost: 1 credit per 1000 tokens, minimum 1 credit per question
    const creditsCost = Math.max(1, Math.ceil(tokenCount / 1000));

    // Deduct from wallet via RPC
    const { data: result, error: deductError } = await user.client.rpc('deduct_wallet_credits', {
      p_user_id: user.id,
      p_building_id: buildingId,
      p_amount: creditsCost,
      p_reason: 'ask_question',
      p_metadata: { chatId, tokens: tokenCount },
    });

    if (deductError) {
      logger.error({
        userId: user.id,
        buildingId,
        chatId,
        error: deductError.message,
        context: 'wallet_deduction_failed',
      });
      return;
    }

    if (!result?.success) {
      logger.warn({
        userId: user.id,
        buildingId,
        chatId,
        error: result?.error,
        context: 'insufficient_credits',
      });
    }
  } catch (err) {
    logger.error({
      userId: user.id,
      buildingId: buildingId,
      chatId,
      error: err instanceof Error ? err.message : 'unknown',
      context: 'chat_credits_exception',
    });
  }
}
