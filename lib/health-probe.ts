import 'server-only';
import { SIGNING_PROBE } from './signing-probe';
import { adminDb } from './supabase/admin';

/**
 * Operational readiness probe. The only place outside ingestion that uses the service role, and only to call
 * `signing_key_matches`, which returns a boolean and is granted to service_role alone. It takes no user input.
 */
export async function probeSigningKey(
  signature: string,
): Promise<{ data: unknown; error: { message: string } | null }> {
  try {
    const { data, error } = await adminDb().rpc('signing_key_matches', {
      p_probe: SIGNING_PROBE,
      p_signature: signature,
    });
    return { data, error };
  } catch {
    return { data: null, error: { message: 'unavailable' } };
  }
}
