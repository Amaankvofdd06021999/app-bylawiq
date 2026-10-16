import 'server-only';
import { z } from 'zod';
import { secret } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { MODEL_IDS } from './models';
import { localStubMode } from './provider-mode';
import { stubEmbedding } from './local-stub';

/**
 * Generate embeddings for legal text using Voyage AI
 * Properly validates API key and error responses
 */
export async function embeddings(texts: string[], type: 'document' | 'query'): Promise<number[][]> {
  if (localStubMode()) return texts.map(stubEmbedding);
  // Verify API key is configured
  if (!process.env.VOYAGE_API_KEY) {
    throw new AppError(
      'embedding_unconfigured',
      'VOYAGE_API_KEY not configured - embeddings service unavailable',
      503,
    );
  }

  try {
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + secret('VOYAGE_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: texts,
        model: MODEL_IDS.embedding,
        input_type: type,
        truncation: false,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      throw new AppError('embedding_unavailable', 'Search indexing is temporarily unavailable.', 503);
    }

    const body = z
      .object({
        data: z.array(
          z.object({
            index: z.number(),
            embedding: z.array(z.number()).length(1024),
          }),
        ),
      })
      .parse(await response.json());

    if (body.data.length !== texts.length) {
      throw new AppError('embedding_mismatch', 'The embedding service returned an incomplete batch.', 503);
    }

    return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('Embeddings API error:', error);
    throw new AppError('embedding_error', 'Embeddings service error - search may be unavailable', 503);
  }
}
