'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui';
import { acceptFirmInvitationAction } from '@/features/firm-team/actions';

/** Accepts a firm invitation. The firm is not named until the invitation is accepted, so none is shown here. */
export function AcceptFirmInvite({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="card" aria-labelledby="accept-firm-heading" style={{ marginBottom: 24 }}>
      <h2 id="accept-firm-heading">You’re invited to join a firm</h2>
      <p className="form-note">You must be signed in with the email address the invitation was sent to.</p>
      <Button
        busy={busy}
        onClick={async () => {
          setBusy(true);
          setError('');
          const result = await acceptFirmInvitationAction({ token });
          setBusy(false);
          if (result.ok) router.replace('/workspace');
          else setError(result.error);
        }}
      >
        Accept invitation
      </Button>
      {error && (
        <p role="alert" className="form-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </section>
  );
}
