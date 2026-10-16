import 'server-only';
import { groq } from '@ai-sdk/groq';
import { localStubMode } from './provider-mode';
import { stubLanguageModel } from './local-stub';

export const MODEL_IDS = {
  answer: process.env.AI_ANSWER_MODEL || 'openai/gpt-oss-120b',
  fast: process.env.AI_FAST_MODEL || 'openai/gpt-oss-20b',
  structure: process.env.AI_STRUCTURE_MODEL || 'openai/gpt-oss-20b',
  embedding: process.env.EMBEDDING_MODEL || 'voyage-law-2',
} as const;

export const MODELS = localStubMode()
  ? {
      answer: stubLanguageModel(),
      draft: stubLanguageModel(),
      fast: stubLanguageModel(),
      classify: stubLanguageModel(),
      structure: stubLanguageModel(),
    }
  : {
      answer: groq(MODEL_IDS.answer),
      draft: groq(MODEL_IDS.answer),
      fast: groq(MODEL_IDS.fast),
      classify: groq(MODEL_IDS.fast),
      structure: groq(MODEL_IDS.structure),
    };
