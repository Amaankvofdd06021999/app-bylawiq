'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Briefcase, Copy, RefreshCw } from 'lucide-react';
import { Button, Badge, Modal } from '@/components/ui';
import { useBackend } from '@/components/backend';
import type { FirmLinkStatus } from '../schema';
export function StrataManagementCard({
  buildingId,
  canManage,
  status,
}: {
  buildingId: string;
  canManage: boolean;
  status: FirmLinkStatus | null;
}) {
  const router = useRouter(),
    backend = useBackend();
  const [code, setCode] = useState<{ code: string; url: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [copied, setCopied] = useState(false);
  if (!status)
    return (
      <section className="card">
        <h2>Strata management</h2>
        <p role="alert" className="form-error">
          Strata management details couldn’t be loaded. Refresh the page to try again.
        </p>
      </section>
    );
  async function invite() {
    setBusy(true);
    setError('');
    const r = await backend.createFirmCode({ buildingId });
    setBusy(false);
    if (r.ok) {
      setCode({ code: r.code, url: r.url });
      router.refresh();
    } else setError(r.error);
  }
  async function revoke() {
    setBusy(true);
    setError('');
    const r = await backend.revokeFirmLink({ buildingId });
    setBusy(false);
    setConfirm(false);
    if (r.ok) {
      setCode(null);
      router.refresh();
    } else setError(r.error);
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Copy failed. Select the code and copy it manually.');
    }
  }
  return (
    <section className="card" aria-labelledby="strata-management-heading">
      <h2 id="strata-management-heading">
        <Briefcase size={18} /> Strata management
      </h2>
      {status.status === 'active' ? (
        <>
          <dl>
            <dt>Firm</dt>
            <dd>{status.firmName}</dd>
            <dt>Connected since</dt>
            <dd>{status.since?.slice(0, 10)}</dd>
          </dl>
          <p className="form-note">
            Everyone at this firm can work on this building. Removing access takes effect immediately and
            returns drafts they’re reviewing to you.
          </p>
          {canManage && (
            <Button
              variant="secondary"
              style={{ marginTop: 20 }}
              disabled={busy}
              onClick={() => setConfirm(true)}
            >
              Remove access
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="form-note">
            {status.status === 'invited'
              ? 'An invitation code is waiting to be used.'
              : 'No strata management firm is connected. Invite your firm so they can work on this building and review your drafts.'}
          </p>
          {status.status === 'invited' && (
            <Badge tone="warning">Invitation expires {status.codeExpiresAt?.slice(0, 10)}</Badge>
          )}
          {code && (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="form-note">
                Share this code with your strata manager. It works once and expires in 7 days.
              </p>
              <p
                style={{ fontSize: 28, fontFamily: 'var(--font-mono, monospace)', letterSpacing: 2 }}
                aria-label={'Invitation code ' + code.code.split('').join(' ')}
              >
                {code.code}
              </p>
              <div className="action-line">
                <Button variant="secondary" size="small" onClick={() => copy(code.code)}>
                  <Copy size={14} />
                  {copied ? 'Copied' : 'Copy code'}
                </Button>
                <Button variant="secondary" size="small" onClick={() => copy(code.url)}>
                  <Copy size={14} />
                  Copy link
                </Button>
              </div>
            </div>
          )}
          {canManage && (
            <Button variant="secondary" style={{ marginTop: 20 }} disabled={busy} onClick={invite}>
              {busy ? (
                'Creating…'
              ) : status.status === 'invited' || code ? (
                <>
                  <RefreshCw size={14} />
                  Create a new code
                </>
              ) : (
                'Invite your strata management firm'
              )}
            </Button>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="form-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
      {confirm && (
        <Modal open={confirm} onOpenChange={setConfirm} title="Remove strata management access?">
          <p>
            {status.firmName} will lose access to this building straight away. Drafts they’re reviewing go
            back to their authors.
          </p>
          <div className="action-line" style={{ marginTop: 20 }}>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={revoke}>
              {busy ? 'Removing…' : 'Remove access'}
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
