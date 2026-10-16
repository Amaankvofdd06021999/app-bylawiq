import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { ForbiddenError, UnauthorizedError, checkDb } from '@/lib/errors';
import { parseSessionClaims, isSessionValid, type Session } from './session';
import type { AppRole } from '@/lib/schema';

export async function requireUser() {
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims?.sub) throw new UnauthorizedError();
  return {
    id: data.claims.sub,
    email: typeof data.claims.email === 'string' ? data.claims.email : '',
    claims: data.claims,
    client,
  };
}

export type SessionUser = Awaited<ReturnType<typeof requireUser>>;

/**
 * Existing guard: Check permission on a building (doesn't validate session role yet).
 * Kept for backward compatibility; new code should use requirePermissionAsRole.
 */
export async function requirePermission(user: SessionUser, permission: string, buildingId: string) {
  const { data, error } = await user.client.rpc('authorize', {
    p_permission: permission,
    p_building: buildingId,
  });
  checkDb(error);
  if (data !== true) throw new ForbiddenError();
}

/**
 * Get current session from JWT claims.
 * Parses and validates the session_role, session_building_id, etc.
 */
export async function getSession(): Promise<Session> {
  const user = await requireUser();
  const session = parseSessionClaims(user.claims);

  if (!isSessionValid(session)) {
    throw new UnauthorizedError('Session expired');
  }

  return session;
}

/**
 * New guard: Check permission AND validate session role matches.
 * This is stricter: ensures the user is acting as the role they claim.
 */
export async function requirePermissionAsRole(
  user: SessionUser,
  permission: string,
  buildingId: string,
  expectedRole: AppRole,
) {
  // 1. Verify session claims match expectations
  const session = parseSessionClaims(user.claims);
  if (session.role !== expectedRole) {
    throw new ForbiddenError('Session role mismatch');
  }
  if (session.buildingId !== buildingId) {
    throw new ForbiddenError('Session building mismatch');
  }

  // 2. Verify permission in database (RLS + role_permissions check)
  const { data, error } = await user.client.rpc('authorize_session', {
    p_permission: permission,
    p_building: buildingId,
    p_role: expectedRole,
  });
  checkDb(error);
  if (data !== true) throw new ForbiddenError();
}

/**
 * Guard: User can access a specific building with their current session.
 */
export async function requireBuildingAccess(user: SessionUser, buildingId: string) {
  const session = parseSessionClaims(user.claims);

  if (!session.accessibleBuildingIds.includes(buildingId) && session.buildingId !== buildingId) {
    throw new ForbiddenError('Cannot access this building');
  }
}

/**
 * Guard: User is acting as a specific role on this building (no permission check, just role).
 */
export async function requireRole(user: SessionUser, buildingId: string, role: AppRole) {
  const session = parseSessionClaims(user.claims);

  if (session.buildingId !== buildingId) {
    throw new ForbiddenError('Session not scoped to this building');
  }
  if (session.role !== role) {
    throw new ForbiddenError(`Session role is ${session.role}, not ${role}`);
  }
}
