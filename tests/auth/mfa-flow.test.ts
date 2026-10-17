import { describe, expect, it } from 'vitest';
import { nextMfaStep, TOTP_CODE_PATTERN, type PlatformAdminStatus } from '@/lib/auth/mfa-flow';

const base: PlatformAdminStatus = {
  isPlatformAdmin: true,
  mfaVerified: false,
  verifiedFactorId: null,
  unverifiedFactorId: null,
};

describe('nextMfaStep', () => {
  it('forbids anyone who is not a platform admin, whatever their factors or session', () => {
    expect(nextMfaStep({ ...base, isPlatformAdmin: false })).toBe('forbidden');
    expect(nextMfaStep({ ...base, isPlatformAdmin: false, mfaVerified: true, verifiedFactorId: 'f' })).toBe(
      'forbidden',
    );
  });

  it('opens the console only for an admin whose session has passed MFA', () => {
    expect(nextMfaStep({ ...base, mfaVerified: true, verifiedFactorId: 'f' })).toBe('done');
  });

  it('asks an admin with a verified authenticator for a code (step-up)', () => {
    expect(nextMfaStep({ ...base, verifiedFactorId: 'f' })).toBe('step_up');
  });

  it('sends an admin with no verified authenticator to enrollment, even if an unverified one exists', () => {
    expect(nextMfaStep(base)).toBe('enroll');
    expect(nextMfaStep({ ...base, unverifiedFactorId: 'u' })).toBe('enroll');
  });
});

describe('TOTP_CODE_PATTERN', () => {
  it('accepts exactly six digits', () => {
    expect(TOTP_CODE_PATTERN.test('123456')).toBe(true);
    expect(TOTP_CODE_PATTERN.test('12345')).toBe(false);
    expect(TOTP_CODE_PATTERN.test('1234567')).toBe(false);
    expect(TOTP_CODE_PATTERN.test('12345a')).toBe(false);
  });
});
