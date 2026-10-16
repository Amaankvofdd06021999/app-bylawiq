import 'server-only';

/**
 * Local-only model stub. `AI_PROVIDER=local-stub` replaces the Groq answer models and the Voyage embeddings with
 * deterministic in-process versions, so the full pipeline (retrieval, scoping, citation validation) can run in the
 * local end-to-end suite without provider credentials.
 *
 * The stub is refused, with an error rather than a silent fallback, when the target is not the local Supabase stack
 * or the process runs on Vercel. Stub output is never production output.
 */

const LOCAL_DATABASE = /^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/;

export function localStubMode(): boolean {
  if (process.env.AI_PROVIDER !== 'local-stub') return false;
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    throw new Error(
      'AI_PROVIDER=local-stub is refused on Vercel. Remove it from the deployment environment.',
    );
  }
  if (!LOCAL_DATABASE.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
    throw new Error('AI_PROVIDER=local-stub requires the local Supabase stack (http://127.0.0.1:54321).');
  }
  return true;
}

/** True when an answer model can run: the Groq key is set, or the local stub is active. */
export function answerModelAvailable(): boolean {
  return Boolean(process.env.GROQ_API_KEY) || localStubMode();
}
