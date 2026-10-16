/** Where a platform admin is in the MFA flow, from platform_admin_status() and the account's TOTP factors. */
export type PlatformAdminStatus = {
  isPlatformAdmin: boolean;
  mfaVerified: boolean;
  verifiedFactorId: string | null;
  unverifiedFactorId: string | null;
};

/**
 * forbidden: not a platform admin, so the admin screens are not shown at all.
 * done: admin with an aal2 session, so the console is open.
 * step_up: admin with a verified authenticator, who must enter a code for this session.
 * enroll: admin with no verified authenticator, who must set one up before the console opens.
 */
export type MfaStep = 'forbidden' | 'done' | 'step_up' | 'enroll';

export function nextMfaStep(status: PlatformAdminStatus): MfaStep {
  if (!status.isPlatformAdmin) return 'forbidden';
  if (status.mfaVerified) return 'done';
  return status.verifiedFactorId ? 'step_up' : 'enroll';
}

/** A six-digit TOTP code, as typed from an authenticator app. */
export const TOTP_CODE_PATTERN = /^\d{6}$/;
