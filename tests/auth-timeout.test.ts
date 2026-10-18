import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logError: vi.fn(),
  signInWithPassword: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.logError, warn: vi.fn(), info: vi.fn() } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-real-ip': '198.51.100.7' }) }));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword } }),
}));
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: mocks.rateLimit }));
vi.mock('@/lib/env', () => ({ appUrl: () => 'http://127.0.0.1:3100', secret: () => 'x' }));

import { withTimeout } from '@/lib/security/with-timeout';
import { authAction } from '@/features/auth/actions';
import { AppError } from '@/lib/errors';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.rateLimit.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('withTimeout', () => {
  it('returns the call result when it finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('done'), 1000, 'step')).resolves.toBe('done');
    expect(mocks.logError).not.toHaveBeenCalled();
  });

  it('rejects with a 504 upstream_timeout error after the limit, and logs only the step name', async () => {
    const hung = new Promise<string>(() => undefined);
    const outcome = withTimeout(hung, 5000, 'auth.sign_in').catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    const error = await outcome;
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'upstream_timeout', status: 504 });
    expect(mocks.logError).toHaveBeenCalledWith({
      context: 'upstream_timeout',
      step: 'auth.sign_in',
      timeoutMs: 5000,
    });
  });

  it('ignores a call that finishes after the limit', async () => {
    let finish: (v: string) => void = () => undefined;
    const late = new Promise<string>((resolve) => {
      finish = resolve;
    });
    const outcome = withTimeout(late, 1000, 'step').catch((e) => e);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await outcome).toBeInstanceOf(AppError);
    finish('too late');
    await vi.advanceTimersByTimeAsync(10);
    expect(mocks.logError).toHaveBeenCalledTimes(1);
  });
});

describe('sign-in action: a hung auth service ends in a bounded, visible error', () => {
  const input = { mode: 'login', email: 'manager@example.invalid', password: 'a-long-enough-password' };

  it('returns a timeout message after the sign-in limit, instead of waiting forever', async () => {
    mocks.signInWithPassword.mockReturnValue(new Promise(() => undefined));
    const outcome = authAction(input);
    await vi.advanceTimersByTimeAsync(12_000);
    const result = await outcome;
    expect(result).toEqual({ ok: false, error: 'That took too long. Check your connection and try again.' });
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ context: 'upstream_timeout', step: 'auth.sign_in' }),
    );
  });

  it('returns a timeout message when the rate-limit step hangs', async () => {
    mocks.rateLimit.mockReturnValue(new Promise(() => undefined));
    const outcome = authAction(input);
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await outcome;
    expect(result).toEqual({ ok: false, error: 'That took too long. Check your connection and try again.' });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it('still signs in normally when the auth service answers in time', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    await expect(authAction(input)).resolves.toEqual({ ok: true, redirect: '/workspace' });
  });

  it('keeps the wrong-password message for a real refusal', async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await expect(authAction(input)).resolves.toEqual({
      ok: false,
      error: 'Email or password is incorrect, or email verification is pending.',
    });
  });
});
