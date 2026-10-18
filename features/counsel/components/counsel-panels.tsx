'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { addCounselCommentAction, grantCounselAccessAction, revokeCounselAccessAction } from '../actions';

export type AmendmentOption = { id: string; label: string };
export type GrantRow = {
  id: string;
  title: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

function statusOf(g: GrantRow, now: Date) {
  if (g.revokedAt) return 'Ended by the manager';
  if (new Date(g.expiresAt) <= now) return 'Expired';
  return 'Active until ' + new Date(g.expiresAt).toLocaleDateString();
}

/** Manager: grant counsel access to one amendment, and see or end the grants on this building. */
export function CounselAccessPanel({
  buildingId,
  amendments,
  grants,
}: {
  buildingId: string;
  amendments: AmendmentOption[];
  grants: GrantRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const now = new Date();

  async function grant(form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true);
    setError('');
    setNotice('');
    const result = await grantCounselAccessAction({
      buildingId,
      versionId: f.get('version'),
      email: f.get('email'),
      days: Number(f.get('days')),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setNotice('Access granted. Counsel can now sign in and open the review packet.');
    form.reset();
    router.refresh();
  }

  async function revoke(grantId: string) {
    setBusy(true);
    setError('');
    setNotice('');
    const result = await revokeCounselAccessAction({ buildingId, grantId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setNotice('Access ended. The grant stays on record.');
    router.refresh();
  }

  return (
    <section aria-labelledby="counsel-access-heading" className="counsel-access">
      <h2 id="counsel-access-heading">Grant counsel access</h2>
      <p className="muted">
        Counsel reads one amendment and its comments for up to 30 days. Counsel cannot edit, approve, adopt,
        or grant access.
      </p>
      {amendments.length === 0 ? (
        <p>No amendments yet. Create a bylaw first, then grant counsel access to it.</p>
      ) : (
        <form
          className="form-stack"
          aria-describedby={error ? 'counsel-error' : undefined}
          onSubmit={(e) => {
            e.preventDefault();
            void grant(e.currentTarget);
          }}
        >
          <label>
            Amendment
            <select name="version" required defaultValue={amendments[0]?.id}>
              {amendments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Counsel’s email address
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="off"
              aria-describedby="counsel-email-hint"
            />
          </label>
          <p id="counsel-email-hint" className="muted">
            Counsel must already have a BylawIQ account with this email address. BylawIQ cannot send an
            invitation yet, so ask counsel to sign up first.
          </p>
          <label>
            Access period
            <select name="days" defaultValue="7">
              {[1, 7, 14, 30].map((d) => (
                <option key={d} value={d}>
                  {d} {d === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </label>
          <div className="form-footer">
            <Button busy={busy}>Grant access</Button>
          </div>
        </form>
      )}
      {error && (
        <p id="counsel-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="form-note">
          {notice}
        </p>
      )}

      <h3>Grants on this building</h3>
      {grants.length === 0 ? (
        <p className="muted">No counsel access has been granted yet.</p>
      ) : (
        <ul className="counsel-grants">
          {grants.map((g) => {
            const active = !g.revokedAt && new Date(g.expiresAt) > now;
            return (
              <li key={g.id}>
                <strong>{g.title}</strong> · {statusOf(g, now)}
                {active && (
                  <>
                    {' '}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void revoke(g.id)}
                    >
                      End access to {g.title}
                    </Button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Counsel: comment on the amendment. Comments are signed with the counsel's own name. */
export function CounselCommentForm({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send(form: HTMLFormElement) {
    const f = new FormData(form);
    setBusy(true);
    setError('');
    const result = await addCounselCommentAction({ grantId, body: f.get('body') });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    form.reset();
    router.refresh();
  }

  return (
    <form
      className="form-stack"
      aria-describedby={error ? 'comment-error' : undefined}
      onSubmit={(e) => {
        e.preventDefault();
        void send(e.currentTarget);
      }}
    >
      <label>
        Your comment
        <textarea name="body" rows={3} required maxLength={2000} />
      </label>
      {error && (
        <p id="comment-error" role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <Button busy={busy}>Send comment</Button>
      </div>
    </form>
  );
}
