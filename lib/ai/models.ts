import 'server-only';
import { anthropic } from '@ai-sdk/anthropic';

export const MODEL_IDS = {
  answer: process.env.AI_ANSWER_MODEL || 'claude-sonnet-5-5',
  fast: process.env.AI_FAST_MODEL || 'claude-haiku-4-5-20251001',
  structure: process.env.AI_STRUCTURE_MODEL || 'claude-haiku-4-5-20251001',
  embedding: process.env.EMBEDDING_MODEL || 'voyage-law-2',
} as const;

export const MODELS = {
  answer: anthropic(MODEL_IDS.answer),
  draft: anthropic(MODEL_IDS.answer),
  fast: anthropic(MODEL_IDS.fast),
  structure: anthropic(MODEL_IDS.structure),
};
