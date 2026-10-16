import 'server-only';
import { createHash } from 'node:crypto';
import { MockLanguageModelV3, convertArrayToReadableStream } from 'ai/test';
import type {
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamPart,
} from '@ai-sdk/provider';

/**
 * Deterministic stand-ins for the answer model and the embedding model, used only when localStubMode() is true.
 * They are NOT a substitute for the production models: they exercise the pipeline's control flow, scoping and citation
 * validation. Retrieval quality and answer quality are unverified until the real providers are configured.
 */

export const EMBEDDING_DIMENSIONS = 1024;

/** Hashed bag-of-words vector, L2-normalised. Identical text always gives an identical vector. */
export function stubEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const token of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    const digest = createHash('sha256').update(token).digest();
    const index = digest.readUInt16BE(0) % EMBEDDING_DIMENSIONS;
    vector[index] += digest[2] & 1 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  // A zero vector has no cosine distance; a unit vector on the first axis keeps the query defined.
  if (norm === 0) {
    vector[0] = 1;
    return vector;
  }
  return vector.map((v) => v / norm);
}

type Message = LanguageModelV3CallOptions['prompt'][number];

function textOf(message: Message): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('');
}

function splitPrompt(options: LanguageModelV3CallOptions) {
  const system: string[] = [];
  const user: string[] = [];
  for (const message of options.prompt) {
    if (message.role === 'system') system.push(textOf(message));
    else if (message.role === 'user') user.push(textOf(message));
  }
  return { system: system.join('\n'), user: user.join('\n') };
}

type StubSource = { id: number; content: string; title: string; kind: string };

/** Answers the grounded-answer prompt: each claim quotes an exact span of a supplied source, as the validator requires. */
function groundedAnswer(userText: string): string {
  const request = JSON.parse(userText) as { sources: StubSource[] };
  const claims = request.sources
    .filter((source) => source.kind === 'building')
    .slice(0, 2)
    .map((source) => {
      const quote = source.content.slice(0, Math.min(200, source.content.length)).trim();
      return quote.length >= 10 ? { text: quote, evidence: [{ source: source.id, quote }] } : null;
    })
    .filter((claim): claim is NonNullable<typeof claim> => claim !== null);
  return JSON.stringify({
    answer: claims.slice(0, 1),
    basis: [],
    nextSteps: [],
    limitations: 'Stub output for local end-to-end testing.',
  });
}

function respond(options: LanguageModelV3CallOptions): string {
  const { system, user } = splitPrompt(options);
  if (system.includes('query expansion assistant')) return JSON.stringify({ variants: [], refs: [] });
  if (system.includes('Classify the intent')) {
    return JSON.stringify({ intent: 'legal_question', confidence: 0.9, reason: 'local stub' });
  }
  if (system.includes('Rank passages')) {
    const passages = (JSON.parse(user) as { passages: Array<{ id: string }> }).passages;
    return JSON.stringify({ ids: passages.map((p) => p.id) });
  }
  return groundedAnswer(user);
}

const usage = {
  inputTokens: { total: 0, noCache: 0, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 0, text: 0, reasoning: undefined },
};

export function stubLanguageModel() {
  return new MockLanguageModelV3({
    provider: 'local-stub',
    modelId: 'local-stub',
    doGenerate: async (options): Promise<LanguageModelV3GenerateResult> => ({
      content: [{ type: 'text', text: respond(options) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage,
      warnings: [],
    }),
    doStream: async (options) => {
      const text = respond(options);
      const parts: LanguageModelV3StreamPart[] = [
        { type: 'stream-start', warnings: [] },
        { type: 'text-start', id: 'stub-text' },
        { type: 'text-delta', id: 'stub-text', delta: text },
        { type: 'text-end', id: 'stub-text' },
        { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
      ];
      return { stream: convertArrayToReadableStream(parts) };
    },
  });
}
