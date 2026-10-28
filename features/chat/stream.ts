import 'server-only';
import { createHmac } from 'node:crypto';
import { streamText, Output, UI_MESSAGE_STREAM_HEADERS, type UIMessageChunk } from 'ai';
import { z } from 'zod';
import type { SessionUser } from '@/lib/auth/guards';
import { requirePermission } from '@/lib/auth/guards';
import { chatSchema } from '@/lib/schema';
import { secret } from '@/lib/env';
import { checkDb, AppError } from '@/lib/errors';
import { answerSchema, isCitableSource, validateCitations, NO_GROUNDING } from '@/lib/ai/citations';
import { answerModelAvailable } from '@/lib/ai/provider-mode';
import { requireLaunchFeature } from '@/lib/launch-scope';
import { logger } from '@/lib/logger';
import { MODELS, MODEL_IDS } from '@/lib/ai/models';
import { DISCLAIMER } from '@/lib/constants';
import { SYSTEM_PROMPT } from './prompts';
import { retrieve } from './retrieval';
import { expandQuery, classifyIntent } from './query-expansion';
import { verifyResidentResponse, auditResidentQA } from './resident-verification-gate';
export async function generateAnswer(
  user: SessionUser,
  chat: z.infer<typeof chatSchema>,
  runId: string,
  question: string,
  history: { role: 'user' | 'assistant'; text: string }[],
  layers?: string[],
) {
  // Refused before any retrieval or model call. The route refuses first; this keeps the model path closed on its own.
  requireLaunchFeature('answers');
  const id = crypto.randomUUID();
  const parts: Array<{ type: string; id?: string; text?: string; data?: unknown }> = [];
  const publication: UIMessageChunk[] = [];
  let completed = false;
  const abort = new AbortController();
  const cancellation = setInterval(async () => {
    const { data } = await user.client
      .from('chat_runs')
      .select('cancel_requested')
      .eq('id', runId)
      .maybeSingle();
    if (!data || data.cancel_requested) abort.abort();
  }, 1500);
  const timeout = setTimeout(() => abort.abort(), 240000);
  let actualTokens = 0;
  async function emit(event: UIMessageChunk) {
    const { error } = await user.client.from('stream_events').insert({ run_id: runId, event });
    checkDb(error);
  }
  async function progress(label: string) {
    await emit({ type: 'data-progress', data: { label }, transient: true });
  }
  async function text(value: string) {
    await emit({ type: 'text-start', id: 'answer' });
    await emit({ type: 'text-delta', id: 'answer', delta: value });
    await emit({ type: 'text-end', id: 'answer' });
    parts.push({ type: 'text', text: value });
  }
  try {
    const signingSecret = secret('SERVER_SIGNING_SECRET');
    await emit({ type: 'start', messageId: id });

    // Step 1: Query expansion (fast model)
    await progress('Expanding query for better retrieval…');
    const expanded = await expandQuery(user, question);
    actualTokens += expanded.tokens ?? 0;

    // Step 2: Intent classification
    const intent = await classifyIntent(question);
    actualTokens += intent.tokens ?? 0;
    if (intent.intent === 'out_of_scope') {
      const declineMsg = `I can only help with questions about building bylaws and strata property law. Your question appears to be outside my scope. ${DISCLAIMER}`;
      parts.push({ type: 'text', text: declineMsg });
      publication.push(
        { type: 'text-start', id: 'answer' },
        { type: 'text-delta', id: 'answer', delta: declineMsg },
        { type: 'text-end', id: 'answer' },
      );

      // Log the out-of-scope question
      if (chat.building_id) {
        await auditResidentQA({
          userId: user.id,
          buildingId: chat.building_id,
          query: question,
          answer: declineMsg,
          sources: [],
          gateResult: { passed: false, issues: ['out_of_scope'] },
          tokens: actualTokens,
          cost: Math.max(0, Math.ceil(actualTokens / 1000)),
        });
      }

      // Skip to message save and return
      const serialized = JSON.stringify(parts);
      const signature = createHmac('sha256', secret('SERVER_SIGNING_SECRET'))
        .update(chat.id + ':' + id + ':' + serialized)
        .digest('hex');
      checkDb(
        (
          await user.client.rpc('append_verified_message', {
            p_chat: chat.id,
            p_id: id,
            p_parts: serialized,
            p_model: MODEL_IDS.answer,
            p_signature: signature,
          })
        ).error,
      );
      for (const event of publication) await emit(event);
      await emit({ type: 'finish', finishReason: 'stop' });
      completed = true;
      return { ok: true, grounded: false, tokens: 0 };
    }

    // Step 3: Retrieve with expanded query variants
    await progress('Searching the selected sources…');
    const result = await retrieve(user, chat, question, layers, expanded.variants);
    if (abort.signal.aborted) throw new AppError('cancelled', 'Generation stopped.');
    // Financial context informs the model but cannot be cited. Without a citable source there is no grounded answer.
    if (!result.sources.some(isCitableSource)) {
      const value = NO_GROUNDING + '\n\n' + DISCLAIMER;
      parts.push({ type: 'text', text: value });
      publication.push(
        { type: 'text-start', id: 'answer' },
        { type: 'text-delta', id: 'answer', delta: value },
        { type: 'text-end', id: 'answer' },
      );
    } else {
      if (!answerModelAvailable())
        throw new AppError('answer_unavailable', 'The answer service is not connected.', 503);
      await progress('Preparing a source-grounded draft…');
      const generated = streamText({
        model: MODELS.answer,
        system: SYSTEM_PROMPT,
        output: Output.object({ schema: answerSchema }),
        messages: [
          ...history.slice(-16).map((m) => ({ role: m.role, content: m.text })),
          {
            role: 'user',
            content: JSON.stringify({
              question,
              scope: chat.scope,
              asOf: chat.as_of,
              agentPurpose: result.instruction,
              sources: result.sources,
            }),
          },
        ],
        maxOutputTokens: 4500,
        abortSignal: abort.signal,
      });
      // Consume the actual model stream. No legal text is released before N2 validates it.
      for await (const part of generated.textStream) {
        void part;
        if (abort.signal.aborted) break;
      }
      const answer = await generated.output;
      const usage = await generated.usage;
      const fallbackTokens = Math.max(1, Math.ceil((question.length + JSON.stringify(answer).length) / 4));
      actualTokens += usage?.totalTokens ?? fallbackTokens;
      await progress('Verifying citations and source quotations…');

      if (!validateCitations(answer, result.sources)) {
        throw new AppError(
          'citation_rejected',
          'The draft did not pass source verification. No legal answer was released. Try a more specific question.',
        );
      }

      if (chat.building_id) {
        const { data: membership, error: membershipError } = await user.client
          .from('building_members')
          .select('role')
          .eq('building_id', chat.building_id)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle();
        checkDb(membershipError);

        if (membership?.role === 'owner_resident') {
          const answerText = answer.answer.map((c) => c.text).join(' ');
          const gateResult = await verifyResidentResponse({
            userId: user.id,
            buildingId: chat.building_id,
            query: question,
            answer: answerText,
            sources: result.sources,
            tokens: 500,
          });

          if (!gateResult.passed) {
            await auditResidentQA({
              userId: user.id,
              buildingId: chat.building_id,
              query: question,
              answer: answerText,
              sources: result.sources,
              gateResult,
              tokens: 500,
              cost: 0,
            });

            throw new AppError(
              'verification_failed',
              `The response did not pass verification. ${gateResult.reason || 'Try a more specific question.'}`,
            );
          }
        }
      } // Revalidate live scope immediately before publishing the grounded output.
      for (const b of chat.scope === 'portfolio'
        ? chat.scope_building_ids
        : chat.building_id
          ? [chat.building_id]
          : [])
        await requirePermission(user, 'chat.use', b);
      const payload = { answer, sources: result.sources };
      publication.push({ type: 'data-answer', id: 'grounded-answer', data: payload });
      parts.push({ type: 'data-answer', id: 'grounded-answer', data: payload });
      const readable = [
        'ANSWER',
        ...answer.answer.map((c) => c.text + ' ' + c.evidence.map((e) => '[' + e.source + ']').join(' ')),
        '\nBASIS',
        ...answer.basis.map((c) => c.text + ' ' + c.evidence.map((e) => '[' + e.source + ']').join(' ')),
        '\nNEXT STEPS',
        ...answer.nextSteps.map((c) => c.text + ' ' + c.evidence.map((e) => '[' + e.source + ']').join(' ')),
        answer.limitations,
        DISCLAIMER,
      ].join('\n');
      parts.push({ type: 'text', text: readable });
      checkDb(
        (
          await user.client.from('retrieval_traces').insert({
            chat_id: chat.id,
            candidate_ids: result.candidateIds,
            used_ids: result.sources.map((s) => s.chunkId),
            corpus_versions: result.versions,
            legal_kb_versions: result.legalKbVersions,
          })
        ).error,
      );
    }
    if (abort.signal.aborted) throw new AppError('cancelled', 'Generation stopped.');

    // Log successful response to audit trail (residents only)
    if (chat.building_id && !result.sources.length) {
      // Empty retrieval was already logged, skip here
    } else if (chat.building_id && result.sources.length > 0) {
      const answerText = parts
        .filter((p: { type: string }) => p.type === 'text')
        .map((p: { text?: string }) => p.text)
        .join('\n');

      await auditResidentQA({
        userId: user.id,
        buildingId: chat.building_id,
        query: question,
        answer: answerText,
        sources: result.sources,
        gateResult: { passed: true, issues: [] },
        tokens: actualTokens,
        cost: Math.max(1, Math.ceil(actualTokens / 1000)),
      });
    }

    const serialized = JSON.stringify(parts);
    const signature = createHmac('sha256', signingSecret)
      .update(chat.id + ':' + id + ':' + serialized)
      .digest('hex');
    checkDb(
      (
        await user.client.rpc('append_verified_message', {
          p_chat: chat.id,
          p_id: id,
          p_parts: serialized,
          p_model: MODEL_IDS.answer,
          p_signature: signature,
        })
      ).error,
    );
    const grounded = parts.find(
      (
        p,
      ): p is {
        type: string;
        data: { answer: z.infer<typeof answerSchema>; sources: typeof result.sources };
      } => typeof p === 'object' && p !== null && 'type' in p && p.type === 'data-answer',
    );
    if (grounded) {
      const evidence = [
        ...grounded.data.answer.answer,
        ...grounded.data.answer.basis,
        ...grounded.data.answer.nextSteps,
      ].flatMap((c) => c.evidence);
      const unique = [...new Map(evidence.map((e) => [e.source, e])).values()];
      for (const e of unique) {
        const s = result.sources.find((s) => s.id === e.source)!;
        if (s.kind === 'firm') continue;
        checkDb(
          (
            await user.client.from('message_citations').insert({
              message_id: id,
              ordinal: s.id,
              kind: s.kind === 'staff' || s.kind === 'financial' ? 'building' : s.kind,
              document_chunk_id: s.kind === 'building' ? s.chunkId : s.kind === 'staff' ? s.chunkId : null,
              legal_chunk_id: s.kind === 'legal' ? s.chunkId : null,
              quoted_span: e.quote,
            })
          ).error,
        );
      }
    }
    checkDb(
      (
        await user.client
          .from('chats')
          .update({
            updated_at: new Date().toISOString(),
            ...(chat.title === 'New conversation' ? { title: question.slice(0, 70) } : {}),
          })
          .eq('id', chat.id)
      ).error,
    );
    for (const event of publication) await emit(event);
    await emit({ type: 'finish', finishReason: 'stop' });
    completed = true;
    return { ok: true, grounded: Boolean(grounded), tokens: actualTokens };
  } catch (e) {
    if (!abort.signal.aborted) {
      // Logged without the question or the answer: only the error class and IDs.
      logger.error({
        context: 'chat_generation',
        userId: user.id,
        buildingId: chat.building_id ?? undefined,
        requestId: runId,
        error: e instanceof Error ? e.name + ': ' + e.message.slice(0, 300) : 'unknown',
      });
    }
    const message = abort.signal.aborted
      ? 'Generation stopped. Your question remains in the conversation.'
      : e instanceof AppError
        ? e.message
        : 'The answer service is unavailable. Your conversation has been saved.';
    try {
      await text(message);
      await emit({ type: 'finish', finishReason: 'error' });
    } catch {
      /* Membership may have been revoked. No further writes are permitted. */
    }
    return { ok: false, grounded: false, tokens: 0 };
  } finally {
    clearInterval(cancellation);
    clearTimeout(timeout);
    await user.client
      .from('chat_runs')
      .update({
        status: completed ? 'complete' : abort.signal.aborted ? 'cancelled' : 'failed',
        heartbeat_at: new Date().toISOString(),
      })
      .eq('id', runId);
  }
}
export function replayStream(user: SessionUser, runId: string, signal: AbortSignal) {
  let cursor = 0;
  let closed = false;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const start = Date.now();
        while (!signal.aborted && !closed && Date.now() - start < 260000) {
          const run = await user.client
            .from('chat_runs')
            .select('status,created_at')
            .eq('id', runId)
            .maybeSingle();
          if (run.error || !run.data) break;
          const result = await user.client
            .from('stream_events')
            .select('id,event')
            .eq('run_id', runId)
            .gt('id', cursor)
            .order('id')
            .limit(100);
          checkDb(result.error);
          for (const row of result.data || []) {
            if (closed) break;
            cursor = Number(row.id);
            controller.enqueue(encoder.encode('data: ' + JSON.stringify(row.event) + '\n\n'));
          }
          if (run.data.status !== 'running') break;
          if (Date.now() - new Date(run.data.created_at).getTime() > 300000) {
            await user.client.from('chat_runs').update({ status: 'failed' }).eq('id', runId);
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 700));
        }
        if (!closed) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          closed = true;
        }
      } catch {
        if (!closed) {
          controller.close();
          closed = true;
        }
      }
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, {
    headers: {
      ...UI_MESSAGE_STREAM_HEADERS,
      'Cache-Control': 'private, no-store',
      'X-Accel-Buffering': 'no',
    },
  });
}
