import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, secret } from '@/lib/env';
/** Allowed callers: inngest/ingest.ts and features/members/invite.ts only (scripts/ingest-kb.ts, an operator CLI, builds its own client).
 * Never use for a user-facing database query. Ingestion revalidates its event's authorized actor.
 */
export function adminDb() {
  return createClient(publicEnv().url, secret('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
