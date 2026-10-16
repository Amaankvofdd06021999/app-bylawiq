'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { nextMfaStep, TOTP_CODE_PATTERN } from '@/lib/auth/mfa-flow';
import { checkDb, ForbiddenError } from '@/lib/errors';
import { readPlatformAdminStatus } from './status';
import { logger } from '@/lib/logger';

/**
 * TOTP enrollment and step-up for platform admins (decision D15).
 * Only a platform admin can reach these actions. The database decides who is an admin (platform_admin_status), and
 * the factor is checked against the one this flow started, so a code for another factor cannot complete a step-up.
 */

const VerifySchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().regex(TOTP_CODE_PATTERN, 'Enter the six-digit code from your app'),
});

export type EnrollTotpResult = { factorId: string; qrCode: string; secret: string };
export type VerifyTotpResult = { ok: true } | { ok: false; error: string };

const INVALID_CODE = 'That code is not valid. Check the code in your authenticator app and try again.';

/** Starts TOTP setup for a platform admin with no verified authenticator. Returns the QR code and manual secret once. */
export async function startTotpEnrollmentAction(): Promise<EnrollTotpResult> {
  const user = await requireUser();
  const status = await readPlatformAdminStatus(user);
  if (nextMfaStep(status) === 'forbidden') throw new ForbiddenError('Only platform admins can set up MFA');
  if (status.verifiedFactorId)
    throw new ForbiddenError('An authenticator is already set up. Enter a code to continue.');

  if (status.unverifiedFactorId) {
    // An abandoned, never-verified enrollment is removed so each attempt starts from one factor.
    const { error } = await user.client.auth.mfa.unenroll({ factorId: status.unverifiedFactorId });
    checkDb(error);
  }

  const { data, error } = await user.client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'BylawIQ admin',
  });
  if (error || !data?.totp) {
    logger.error({ context: 'mfa.enroll', userId: user.id, message: error?.message ?? 'no totp data' });
    throw new ForbiddenError('Could not start authenticator setup. Try again.');
  }
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * Verifies a code. On an enrollment, the code completes setup. On a step-up, it upgrades this session to aal2.
 * Wrong codes return a generic message and nothing else.
 */
export async function verifyTotpAction(raw: unknown): Promise<VerifyTotpResult> {
  const user = await requireUser();
  const input = VerifySchema.parse(raw);
  const status = await readPlatformAdminStatus(user);
  const step = nextMfaStep(status);
  if (step === 'forbidden') throw new ForbiddenError('Only platform admins can verify MFA');
  if (step === 'done') return { ok: true };

  const expected = step === 'enroll' ? status.unverifiedFactorId : status.verifiedFactorId;
  if (!expected || expected !== input.factorId)
    throw new ForbiddenError('This authenticator is not the one being set up');

  const { error } = await user.client.auth.mfa.challengeAndVerify({
    factorId: input.factorId,
    code: input.code,
  });
  if (error) {
    logger.warn({ context: 'mfa.verify', userId: user.id, step });
    return { ok: false, error: INVALID_CODE };
  }
  return { ok: true };
}
