import { z } from 'zod';
import { AppError } from '@/lib/errors';

/**
 * Malware scanning before a file is parsed. Fails closed: a missing scanner, an error, a timeout, a malformed verdict,
 * or any verdict other than clean stops ingestion. Nothing here skips scanning on its own. The caller decides when a
 * scan is required, and only a local stub may waive it.
 */

const VerdictSchema = z.object({ clean: z.boolean() });
const SCAN_TIMEOUT_MS = 60_000;

export type ScanConfig = { url?: string; token?: string };

export function scanConfigFrom(env: Record<string, string | undefined> = process.env): ScanConfig {
  return { url: env.FILE_SCAN_URL || undefined, token: env.FILE_SCAN_TOKEN || undefined };
}

/** Throws unless the bytes are scanned and clean. Returns normally only for a clean verdict. */
export async function assertFileClean(
  bytes: Uint8Array,
  config: ScanConfig,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!config.url || !config.token) {
    throw new AppError(
      'scanner_unavailable',
      'The malware scanner must be connected before this file can be processed.',
      503,
    );
  }
  let response: Response;
  try {
    response = await fetcher(config.url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + config.token, 'Content-Type': 'application/octet-stream' },
      body: bytes as BodyInit,
      signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
    });
  } catch {
    throw new AppError('scanner_unavailable', 'The malware scanner did not respond. Try again later.', 503);
  }
  if (!response.ok) {
    throw new AppError('scanner_unavailable', 'The malware scanner did not respond. Try again later.', 503);
  }
  const parsed = VerdictSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) {
    throw new AppError(
      'scanner_unavailable',
      'The malware scanner returned an unreadable result. Try again later.',
      503,
    );
  }
  if (!parsed.data.clean) {
    throw new AppError('scan_failed', 'This file did not pass the malware scan.');
  }
}
