import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import type { PlatformAdminStatus } from '@/lib/auth/mfa-flow';
import { checkDb } from '@/lib/errors';

/**
 * The caller's platform-admin and MFA flags only, from the database. Verification uses this instead of the full status:
 * the factor list costs two auth-service round trips, and the auth service already checks that the factor belongs to the
 * caller when the code is verified.
 */
export async function readAdminFlags(
  user: SessionUser,
): Promise<{ isPlatformAdmin: boolean; mfaVerified: boolean }> {
  const { data, error } = await user.client.rpc('platform_admin_status');
  checkDb(error);
  const row = Array.isArray(data) ? data[0] : undefined;
  return { isPlatformAdmin: row?.is_platform_admin === true, mfaVerified: row?.mfa_verified === true };
}

/** The caller's platform-admin and MFA state, from the database (platform_admin_status) and the account's factors. */
export async function readPlatformAdminStatus(user: SessionUser): Promise<PlatformAdminStatus> {
  const { data, error } = await user.client.rpc('platform_admin_status');
  checkDb(error);
  const row = Array.isArray(data) ? data[0] : undefined;
  const { data: factorData, error: factorError } = await user.client.auth.mfa.listFactors();
  checkDb(factorError);
  // `all` holds unverified factors too; `totp` only lists verified ones, so it cannot find an enrollment in progress.
  const totp = (factorData?.all ?? []).filter((f) => f.factor_type === 'totp');
  return {
    isPlatformAdmin: row?.is_platform_admin === true,
    mfaVerified: row?.mfa_verified === true,
    verifiedFactorId: totp.find((f) => f.status === 'verified')?.id ?? null,
    unverifiedFactorId: totp.find((f) => f.status === 'unverified')?.id ?? null,
  };
}
