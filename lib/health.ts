import 'server-only';

import { signingProbeSignature } from './signing-probe';

/** Database reachability, checked through the Data API. */
export type DatabaseHealth = 'ok' | 'unreachable' | 'not_configured';

const CHECK_TIMEOUT_MS = 3000;

export async function checkDatabase(
  url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  fetcher: typeof fetch = fetch,
): Promise<DatabaseHealth> {
  if (!url || !key) return 'not_configured';
  try {
    // An anonymous call to a function the anon role may not run still goes through Postgres, so any status below
    // 500 means the database answered. A 5xx (PostgREST returns 503 when Postgres is down) means it did not.
    const res = await fetcher(`${url.replace(/\/$/, '')}/rest/v1/rpc/platform_admin_status`, {
      method: 'POST',
      headers: { apikey: key, 'Content-Type': 'application/json' },
      body: '{}',
      cache: 'no-store',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    return res.status < 500 ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

export type SigningHealth = 'match' | 'mismatch' | 'not_configured' | 'unavailable';

/**
 * Whether the app's SERVER_SIGNING_SECRET and the database's signing key are the same. The probe returns only a boolean:
 * no key material crosses the wire. A mismatch means trusted assistant messages cannot be saved, so Ask is not ready.
 */
export async function checkSigning(
  secret: string | undefined,
  probe: (signature: string) => Promise<{ data: unknown; error: { message: string } | null }>,
): Promise<SigningHealth> {
  if (!secret) return 'not_configured';
  try {
    const { data, error } = await probe(signingProbeSignature(secret));
    if (error) return 'unavailable';
    return data === true ? 'match' : 'mismatch';
  } catch {
    return 'unavailable';
  }
}
