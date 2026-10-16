// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { localStubMode, answerModelAvailable } from '@/lib/ai/provider-mode';
import { stubEmbedding, stubLanguageModel, EMBEDDING_DIMENSIONS } from '@/lib/ai/local-stub';
import { answerSchema, validateCitations, type Source } from '@/lib/ai/citations';

const LOCAL = 'http://127.0.0.1:54321';
const KEYS = ['AI_PROVIDER', 'VERCEL', 'VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL', 'GROQ_API_KEY'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  for (const k of KEYS) delete process.env[k];
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('local stub guard', () => {
  it('is off unless AI_PROVIDER=local-stub is set', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL;
    expect(localStubMode()).toBe(false);
  });

  it('is on for the local stack', () => {
    process.env.AI_PROVIDER = 'local-stub';
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL;
    expect(localStubMode()).toBe(true);
    expect(answerModelAvailable()).toBe(true);
  });

  it('is refused on Vercel, even with the local URL', () => {
    process.env.AI_PROVIDER = 'local-stub';
    process.env.NEXT_PUBLIC_SUPABASE_URL = LOCAL;
    process.env.VERCEL_ENV = 'preview';
    expect(() => localStubMode()).toThrow(/refused on Vercel/);
  });

  it('is refused against any non-local database', () => {
    process.env.AI_PROVIDER = 'local-stub';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    expect(() => localStubMode()).toThrow(/requires the local Supabase stack/);
  });

  it('does not make the answer model available without a key or the stub', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://project.supabase.co';
    expect(answerModelAvailable()).toBe(false);
    process.env.GROQ_API_KEY = 'configured';
    expect(answerModelAvailable()).toBe(true);
  });
});

describe('stubEmbedding', () => {
  it('returns a normalised vector of the production dimension', () => {
    const v = stubEmbedding('Pets are limited to two per unit');
    expect(v).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
  });

  it('is deterministic and separates different text', () => {
    expect(stubEmbedding('pets rule')).toEqual(stubEmbedding('pets rule'));
    expect(stubEmbedding('pets rule')).not.toEqual(stubEmbedding('parking rule'));
  });

  it('never returns a zero vector, even for empty input', () => {
    expect(Math.hypot(...stubEmbedding(''))).toBeCloseTo(1, 6);
  });
});

describe('stub answer model', () => {
  it('answers the query-expansion prompt with JSON, not the question', async () => {
    const result = await stubLanguageModel().doGenerate({
      prompt: [
        { role: 'system', content: 'You are a legal query expansion assistant. Expand queries.' },
        { role: 'user', content: [{ type: 'text', text: 'Expand this query:\n"pets"' }] },
      ],
    } as never);
    const text = result.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
    expect(JSON.parse(text)).toEqual({ variants: [], refs: [] });
  });

  it('answers with claims whose evidence is an exact span of the supplied source, which the citation validator accepts', async () => {
    const sources: Source[] = [
      {
        id: 1,
        chunkId: '93000000-0000-4000-8000-0000000000c1',
        kind: 'building',
        title: 'Pet rules',
        content:
          'Pets are limited to two per unit under the pet rules adopted in 2024. Dogs must be leashed in common areas.',
        sectionRef: '3.1',
        effectiveDate: '2024-01-01',
        buildingId: '93000000-0000-4000-8000-00000000000a',
        page: null,
        citation: null,
      },
    ];
    const model = stubLanguageModel();
    const result = await model.doGenerate({
      prompt: [
        { role: 'system', content: 'You are a grounded assistant.' },
        {
          role: 'user',
          content: [{ type: 'text', text: JSON.stringify({ question: 'How many pets?', sources }) }],
        },
      ],
    } as never);
    const text = result.content.map((p) => (p.type === 'text' ? p.text : '')).join('');
    const answer = answerSchema.parse(JSON.parse(text));
    expect(answer.answer.length).toBeGreaterThan(0);
    expect(validateCitations(answer, sources)).toBe(true);
    expect(answer.answer[0].evidence[0].quote).toBe(
      sources[0].content.slice(0, answer.answer[0].evidence[0].quote.length),
    );
  });

  it('fails citation validation when the evidence is not in the source', () => {
    const sources: Source[] = [
      {
        id: 1,
        chunkId: '93000000-0000-4000-8000-0000000000c1',
        kind: 'building',
        title: 'Pet rules',
        content: 'Pets are limited to two per unit.',
        sectionRef: null,
        effectiveDate: null,
        buildingId: null,
        page: null,
        citation: null,
      },
    ];
    const fabricated = {
      answer: [{ text: 'Invented', evidence: [{ source: 1, quote: 'Pets are limited to ten per unit.' }] }],
      basis: [],
      nextSteps: [],
      limitations: 'None.',
    };
    expect(validateCitations(fabricated, sources)).toBe(false);
  });
});

describe('citation validation: only stored passages can be cited', () => {
  it('rejects evidence that points at financial context, which has no stored passage', () => {
    const sources: Source[] = [
      {
        id: 1,
        chunkId: '93000000-0000-4000-8000-0000000000d1',
        kind: 'financial',
        title: 'Building spending',
        content: 'Building spending this month: 0 questions asked, $0 spent.',
        sectionRef: null,
        effectiveDate: null,
        buildingId: null,
        page: null,
        citation: null,
        isFinancialContext: true,
      },
    ];
    const answer = {
      answer: [
        {
          text: 'Building spending this month: 0 questions asked, $0 spent.',
          evidence: [{ source: 1, quote: 'Building spending this month: 0 questions asked, $0 spent.' }],
        },
      ],
      basis: [],
      nextSteps: [],
      limitations: 'None.',
    };
    expect(validateCitations(answer, sources)).toBe(false);
  });
});
