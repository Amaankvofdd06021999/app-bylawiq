'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import {
  startTotpEnrollmentAction,
  verifyTotpAction,
  type EnrollTotpResult,
} from '@/features/admin/mfa/actions';

type Props = {
  /** enroll: no verified authenticator yet. step_up: an authenticator exists but this session has not passed MFA. */
  mode: 'enroll' | 'step_up';
  verifiedFactorId: string | null;
};

const GENERIC_FAILURE = 'Something went wrong. Try again.';
const CHECK_DEADLINE_MS = 15_000;
const TOO_SLOW = 'The check did not finish. Enter the current code from your app and try again.';

class DeadlineError extends Error {}

/** Rejects if the work does not settle in time, so a check can never leave the form disabled. */
async function withDeadline<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new DeadlineError()), CHECK_DEADLINE_MS);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

export function MfaSetup({ mode, verifiedFactorId }: Props) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<EnrollTotpResult | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [enrolling, startEnrolling] = useTransition();

  const factorId = mode === 'enroll' ? (enrollment?.factorId ?? null) : verifiedFactorId;
  const canSubmit = !checking && factorId !== null && /^\d{6}$/.test(code);

  function beginEnrollment() {
    setError(null);
    startEnrolling(async () => {
      try {
        setEnrollment(await startTotpEnrollmentAction());
      } catch {
        setError(GENERIC_FAILURE);
      }
    });
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || checking) return;
    setError(null);
    setChecking(true);
    try {
      const result = await withDeadline(verifyTotpAction({ factorId, code }));
      if (result.ok) {
        router.replace('/admin/platform');
        router.refresh();
        return;
      }
      setError(result.error);
      setCode('');
    } catch (e) {
      setError(e instanceof DeadlineError ? TOO_SLOW : GENERIC_FAILURE);
    } finally {
      setChecking(false);
    }
  }

  return (
    <section aria-labelledby="mfa-heading" className="mfa-setup">
      <h2 id="mfa-heading">{mode === 'enroll' ? 'Set up your authenticator app' : 'Confirm it is you'}</h2>
      <p>
        {mode === 'enroll'
          ? 'Platform admin tools need a six-digit code from an authenticator app on every sign-in.'
          : 'Enter the six-digit code from your authenticator app to open the platform console.'}
      </p>

      {mode === 'enroll' && !enrollment ? (
        <button type="button" onClick={beginEnrollment} disabled={enrolling}>
          {enrolling ? 'Starting setup…' : 'Start setup'}
        </button>
      ) : null}

      {mode === 'enroll' && enrollment ? (
        <div className="mfa-enrollment">
          <Image
            src={enrollment.qrCode}
            alt="QR code to add BylawIQ to your authenticator app"
            width={200}
            height={200}
            unoptimized
          />
          <p>
            Can&apos;t scan it? Enter this key in your app: <code>{enrollment.secret}</code>
          </p>
        </div>
      ) : null}

      {factorId ? (
        <form onSubmit={submitCode} noValidate>
          <label htmlFor="mfa-code">Six-digit code</label>
          <input
            id="mfa-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            aria-invalid={error !== null}
            aria-describedby={error ? 'mfa-error' : undefined}
            disabled={checking}
          />
          <button type="submit" disabled={!canSubmit}>
            {checking ? 'Checking…' : mode === 'enroll' ? 'Finish setup' : 'Confirm'}
          </button>
        </form>
      ) : null}

      {error ? (
        <p id="mfa-error" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
