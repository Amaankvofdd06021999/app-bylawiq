import 'server-only';
import {anthropic} from '@ai-sdk/anthropic';
import {groq} from '@ai-sdk/groq';
export const MODEL_IDS={answer:process.env.AI_ANSWER_MODEL||'claude-sonnet-5',fast:process.env.AI_FAST_MODEL||'llama-3.1-8b-instant',structure:process.env.AI_STRUCTURE_MODEL||'openai/gpt-oss-120b',embedding:'voyage-law-2'} as const;
export const MODELS={answer:anthropic(MODEL_IDS.answer),draft:anthropic(MODEL_IDS.answer),fast:groq(MODEL_IDS.fast),structure:groq(MODEL_IDS.structure)};
