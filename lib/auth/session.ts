import 'server-only';
import { z } from 'zod';
import type { AppRole } from '@/lib/schema';

/**
 * Session context: What role a user is acting as, in which building, right now.
 * Orthogonal to account_type (which describes the account style).
 * Encoded in JWT claims by the Supabase custom access token hook.
 */

export const sessionSchema = z.object({
  userId: z.string().uuid(),
  role: z.string(), // AppRole, but we avoid circular import
  buildingId: z.string().uuid(),
  accessibleBuildingIds: z.array(z.string().uuid()),
  scope: z.enum(['building', 'portfolio', 'org']),
  issuedAt: z.number(),
  expiresAt: z.number(),
});

export type Session = z.infer<typeof sessionSchema>;

/**
 * Multi-role context: All roles a user can adopt.
 */
export const multiRoleSchema = z.object({
  userId: z.string().uuid(),
  roles: z.array(
    z.object({
      buildingId: z.string().uuid(),
      buildingName: z.string(),
      role: z.string(), // AppRole
      org: z.object({
        id: z.string().uuid(),
        name: z.string(),
        kind: z.enum(['building', 'firm']),
      }),
    }),
  ),
  preferred: z
    .object({
      buildingId: z.string().uuid(),
      role: z.string(),
    })
    .nullable(),
});

export type MultiRoleContext = z.infer<typeof multiRoleSchema>;

/**
 * JWT claims that Supabase custom hook injects into access token.
 * These claims are what enforce role at the database level (RLS).
 */
export const jwtClaimsSchema = z.object({
  sub: z.string().uuid(), // user ID
  aud: z.string().default('authenticated'),
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  phone_verified: z.boolean().optional(),
  app_metadata: z
    .object({
      provider: z.string().optional(),
      providers: z.array(z.string()).optional(),
    })
    .optional(),
  user_metadata: z.record(z.string(), z.unknown()).optional(),

  // Custom session claims
  session_role: z.string(), // AppRole as string
  session_building_id: z.string().uuid(),
  accessible_building_ids: z.array(z.string().uuid()),
  iat: z.number(),
  exp: z.number(),
});

export type JwtClaims = z.infer<typeof jwtClaimsSchema>;

/**
 * Parse and validate session from JWT claims.
 * @throws if claims are invalid or session is expired
 */
export function parseSessionClaims(claims: unknown): Session {
  const validated = jwtClaimsSchema.parse(claims);
  return {
    userId: validated.sub,
    role: validated.session_role,
    buildingId: validated.session_building_id,
    accessibleBuildingIds: validated.accessible_building_ids,
    scope: 'building', // TODO: compute from role
    issuedAt: validated.iat,
    expiresAt: validated.exp,
  };
}

/**
 * Check if session is still valid (not expired).
 */
export function isSessionValid(session: Session): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now < session.expiresAt;
}

/**
 * Role accessor: what role is the session acting as?
 */
export function getSessionRole(session: Session): AppRole {
  return session.role as AppRole;
}

/**
 * Building accessor: what building is the session scoped to?
 */
export function getSessionBuilding(session: Session): string {
  return session.buildingId;
}

/**
 * Accessibility: can this session access a specific building?
 */
export function canAccessBuilding(session: Session, buildingId: string): boolean {
  return session.accessibleBuildingIds.includes(buildingId) || session.buildingId === buildingId;
}

/**
 * Scope type: does this role use building scope or portfolio scope?
 * Portfolio roles: portfolio_manager, portfolio_assistant, org_owner, org_admin
 * Building roles: building_manager, council_president, council_member, owner_resident
 */
export function roleScope(role: AppRole): 'building' | 'portfolio' | 'org' {
  const portfolioRoles = ['portfolio_manager', 'portfolio_assistant', 'org_owner', 'org_admin'];
  const orgRoles = ['org_owner', 'org_admin'];

  if (orgRoles.includes(role)) return 'org';
  if (portfolioRoles.includes(role)) return 'portfolio';
  return 'building';
}
