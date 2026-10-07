'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { db } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, errorMessage, AppError } from '@/lib/errors';
import { role } from '@/lib/schema';

/**
 * Server action: Switch the user's active role/building in the current session.
 *
 * Flow:
 * 1. Validate user has membership on target building with target role
 * 2. Call Supabase to regenerate access token with new session claims
 * 3. Redirect to new building's view
 *
 * Note: Actual JWT regeneration happens in the custom access token hook
 * (lib/auth/access-token-hook.ts). This action just updates state/cookies
 * to signal preference to Supabase.
 */
export async function switchRoleAction(raw: unknown) {
  try {
    const v = z
      .object({
        buildingId: z.string().uuid(),
        role: role,
      })
      .parse(raw);

    const user = await requireUser();

    // Verify user has this membership
    const { data: membership, error } = await user.client
      .from('building_members')
      .select('id, role, status, expires_at')
      .eq('building_id', v.buildingId)
      .eq('user_id', user.id)
      .maybeSingle();

    checkDb(error);
    if (!membership) {
      throw new AppError('not_found', 'You do not have access to this building.');
    }

    if (membership.status !== 'active') {
      throw new AppError('forbidden', 'Your membership is not active.');
    }

    if (membership.expires_at && new Date(membership.expires_at) < new Date()) {
      throw new AppError('forbidden', 'Your membership has expired.');
    }

    if (membership.role !== v.role) {
      throw new AppError('forbidden', `You are not a ${v.role} on this building.`);
    }

    // Refresh auth session to trigger access token hook
    // This will re-generate the JWT with new session_role + session_building_id claims
    const { error: refreshError } = await user.client.auth.refreshSession();
    checkDb(refreshError);

    // Set a preference cookie so the token hook knows which building to pick
    // (In a real app, this could also be set via URL param or local storage)
    // For now, we'll rely on the token hook's logic to pick the preferred building.

    // Redirect to the new building's view
    redirect(`/b/${v.buildingId}/ask`);
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get all roles the user can switch to.
 * Returns building info + role for each membership.
 */
export async function getAvailableRoles() {
  try {
    const user = await requireUser();

    const { data: memberships, error } = await user.client
      .from('building_members')
      .select('building_id, role, buildings(id, name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('buildings(name)');

    checkDb(error);

    return {
      ok: true,
      roles: (memberships || []).map((m: any) => ({
        buildingId: m.building_id,
        buildingName: m.buildings?.name || 'Unknown',
        role: m.role,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e), roles: [] };
  }
}

/**
 * Log a role switch for audit purposes.
 */
export async function logRoleSwitch(buildingId: string, newRole: string) {
  try {
    const user = await requireUser();

    // Log to audit_log
    const { error } = await user.client.from('audit_log').insert({
      actor_id: user.id,
      building_id: buildingId,
      action: 'auth.switch_role',
      metadata: JSON.stringify({ new_role: newRole }),
    });

    checkDb(error);
    return { ok: true };
  } catch (e) {
    // Non-fatal: don't block role switch if audit fails
    console.error('Failed to log role switch:', e);
    return { ok: false };
  }
}
