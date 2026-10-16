import 'server-only';
import { generateText } from 'ai';
import { MODELS } from '@/lib/ai/models';
import type { SessionUser } from '@/lib/auth/guards';

/**
 * Query expansion with the fast model
 * Expands a single query into variants for better retrieval coverage
 * "can we tow a car" → ["can we tow a car", "remove vehicle common property", "parking enforcement"]
 */

export interface QueryExpansion {
  original: string;
  variants: string[];
  extractedRefs: string[]; // Section numbers, case citations, etc.
}

export async function expandQuery(
  user: SessionUser,
  originalQuery: string,
  buildingName?: string,
): Promise<QueryExpansion> {
  try {
    const systemPrompt = `You are a legal query expansion assistant. Your job is to expand queries for retrieval against building bylaws and BC strata legislation.

Given a user query, you will:
1. Generate 2-3 semantic variants that paraphrase the query differently
2. Extract any section references, case citations, or defined terms
3. Return JSON with "variants" (array of strings) and "refs" (array of strings)

Important: Return ONLY valid JSON. No markdown, no explanation.

Example:
User: "can we tow a car"
Output: {"variants": ["can we tow a car", "vehicle removal from common property", "parking enforcement"], "refs": []}

Example with refs:
User: "what does section 3.2 say"
Output: {"variants": ["section 3.2", "bylaw 3.2"], "refs": ["3.2", "section 3.2"]}`;

    const { text } = await generateText({
      model: MODELS.classify,
      system: systemPrompt,
      prompt: `Expand this query:\n"${originalQuery}"${buildingName ? `\n\nBuilding: ${buildingName}` : ''}`,
      temperature: 0.7,
    });

    const parsed = JSON.parse(text.trim());
    return {
      original: originalQuery,
      variants: Array.isArray(parsed.variants) ? parsed.variants : [originalQuery],
      extractedRefs: Array.isArray(parsed.refs) ? parsed.refs : [],
    };
  } catch (error) {
    console.error('Query expansion failed:', error);
    // Graceful degradation: return original query if expansion fails
    return {
      original: originalQuery,
      variants: [originalQuery],
      extractedRefs: [],
    };
  }
}

/**
 * Intent classification for routing
 * Legal question → full Sonnet reasoning
 * Factual lookup → faster Haiku
 * Out of scope → decline with explanation
 */

export type Intent = 'legal_question' | 'factual_lookup' | 'document_search' | 'out_of_scope';

export interface IntentClassification {
  intent: Intent;
  confidence: number; // 0.0-1.0
  reason?: string;
}

export async function classifyIntent(query: string): Promise<IntentClassification> {
  try {
    const systemPrompt = `Classify the intent of building-related queries.

Intent types:
- legal_question: Asks about interpretation of bylaws, rules, enforceability ("can they fine me for this?")
- factual_lookup: Asks for facts from documents ("what's the AGM date?", "how many votes needed?")
- document_search: Asks to find specific information ("where's the parking policy?")
- out_of_scope: Not about building rules (e.g., legal advice against building, Ontario law)

Respond with JSON only: {"intent": "...", "confidence": 0.9, "reason": "..."}`;

    const { text } = await generateText({
      model: MODELS.classify,
      system: systemPrompt,
      prompt: `Classify: "${query}"`,
      temperature: 0.3,
    });

    const parsed = JSON.parse(text.trim());
    return {
      intent: parsed.intent || 'legal_question',
      confidence: Number(parsed.confidence) || 0.8,
      reason: parsed.reason,
    };
  } catch (error) {
    console.error('Intent classification failed:', error);
    return {
      intent: 'legal_question',
      confidence: 0.5,
      reason: 'Classification unavailable',
    };
  }
}
