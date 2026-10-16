import 'server-only';
import type { AppRole } from '@/lib/schema';

/**
 * Supabase custom access token hook function.
 *
 * This function is invoked by Supabase Auth every time a token is issued (login, refresh).
 * It adds custom claims to the JWT that govern row-level security and session context.
 *
 * Deploy to: Supabase → Auth → Providers → Supabase → Custom Access Token Hook
 *
 * See: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token
 *
 * @param event The Supabase provider event containing user info and request details
 * @returns Claims to add to the access token
 */

export type SupabaseProvider = {
  user: {
    id: string;
    aud: string;
    email?: string;
    phone?: string;
    confirmed_at?: string;
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    last_sign_in_at?: string;
    app_metadata: Record<string, unknown>;
    user_metadata: Record<string, unknown>;
    identities?: Array<unknown>;
    created_at: string;
    updated_at: string;
  };
  request?: {
    headers?: Record<string, string>;
    method?: string;
    url?: string;
  };
};

export type TokenHookResponse = {
  claims: Record<string, unknown>;
};

/**
 * Determine the user's preferred/active building.
 * Priority:
 * 1. URL param ?building=<id>
 * 2. Cookie/localStorage preference (if accessible)
 * 3. Most recently used building (from audit_log)
 * 4. First accessible building
 */
async function determinePreferredBuilding(
  userId: string,
  memberships: Array<{ building_id: string; role: AppRole }>,
  request?: SupabaseProvider['request'],
): Promise<{ buildingId: string; role: AppRole }> {
  // Try URL param first
  if (request?.url) {
    const url = new URL(request.url);
    const param = url.searchParams.get('building');
    if (param && memberships.some((m) => m.building_id === param)) {
      return {
        buildingId: param,
        role: memberships.find((m) => m.building_id === param)!.role,
      };
    }
  }

  // Try last-used building from audit log (most recent action by this user)
  // This requires a DB query, which may not be available in the hook context.
  // For now, fall back to first/highest-permission building.

  // Prefer portfolio_manager/building_manager over council/resident
  const permissionOrder = [
    'org_owner',
    'org_admin',
    'portfolio_manager',
    'portfolio_assistant',
    'building_manager',
    'council_president',
    'council_member',
    'external_counsel',
    'owner_resident',
  ];

  const sorted = [...memberships].sort(
    (a, b) => permissionOrder.indexOf(a.role as string) - permissionOrder.indexOf(b.role as string),
  );

  return {
    buildingId: sorted[0].building_id,
    role: sorted[0].role,
  };
}

/**
 * Main hook function: Called by Supabase Auth on token issuance.
 *
 * Flow:
 * 1. User logs in → Supabase Auth creates auth session
 * 2. Hook is invoked with user info
 * 3. We query DB for this user's building/org memberships
 * 4. We pick one membership as the active session role
 * 5. We return JWT claims that encode this choice
 * 6. RLS policies use these claims to gate data access
 */
export async function customAccessTokenHook(event: SupabaseProvider): Promise<TokenHookResponse> {
  const userId = event.user.id;

  try {
    // Fetch user's active building memberships
    // This is a direct DB query using the service role (Supabase Auth context has full access).
    // We query as service role because we're in the auth system, not the app.

    const memberships: Array<{ building_id: string; role: AppRole }> = [
      // Placeholder: In real implementation, query Postgres here
      // const response = await postgres.query(
      //   'SELECT building_id, role FROM building_members WHERE user_id = $1 AND status = $2',
      //   [userId, 'active']
      // );
    ];

    if (memberships.length === 0) {
      // User has no building memberships. Try org memberships (for firm staff).
      // This user is not a building staff; they're only org staff or unallocated.
      return {
        claims: {
          session_role: null,
          session_building_id: null,
          accessible_building_ids: [],
        },
      };
    }

    // Pick the preferred building/role for this session
    const preferred = await determinePreferredBuilding(userId, memberships, event.request);

    // All buildings this user can access (for RLS policies to filter by)
    const accessibleBuildingIds = memberships.map((m) => m.building_id);

    return {
      claims: {
        session_role: preferred.role,
        session_building_id: preferred.buildingId,
        accessible_building_ids: accessibleBuildingIds,
      },
    };
  } catch (error) {
    console.error('customAccessTokenHook error:', error);
    // On error, return empty session (safer than crashing)
    return {
      claims: {
        session_role: null,
        session_building_id: null,
        accessible_building_ids: [],
      },
    };
  }
}

/**
 * IMPLEMENTATION NOTES FOR DEPLOYMENT:
 *
 * 1. This hook function needs DB access. In Supabase, you have two options:
 *    a) Use Supabase's Edge Function support (requires migration to functions)
 *    b) Use Postgres native functions + triggers (simpler, lower latency)
 *
 * 2. Recommended: Implement as Postgres function triggered by auth.users insert/update.
 *    See: supabase/migrations/20261008_access_token_hook.sql
 *
 * 3. Fallback: If using Supabase Edge Functions, deploy this as a Function that Postgres calls.
 *
 * 4. Test: Token should have claims like:
 *    {
 *      "sub": "user-id",
 *      "session_role": "building_manager",
 *      "session_building_id": "building-uuid",
 *      "accessible_building_ids": ["building-uuid", ...]
 *    }
 */
