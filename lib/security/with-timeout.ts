import 'server-only';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

/**
 * Limits for the sign-in path. Worst case is rate limit plus sign-in, which the client's own deadline (25 s, in auth-form)
 * must exceed.
 */
export const AUTH_STEP_TIMEOUT_MS = { rateLimit: 8_000, signIn: 12_000 } as const;

/**
 * Bounds one external call (a database RPC or an auth-service request). If it has not returned within `ms`, the caller gets
 * a visible 504 error that names no internal detail, and the log records only the step name. The underlying call is not
 * cancelled: it finishes or fails on its own, and its result is ignored.
 */
export function withTimeout<T>(call: PromiseLike<T>, ms: number, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      logger.error({ context: 'upstream_timeout', step, timeoutMs: ms });
      reject(
        new AppError('upstream_timeout', 'That took too long. Check your connection and try again.', 504),
      );
    }, ms);
  });
  return Promise.race([Promise.resolve(call), deadline]).finally(() => clearTimeout(timer));
}
