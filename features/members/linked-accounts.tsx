'use client';
import { useState, useEffect } from 'react';
import { Link2, ArrowRightLeft, Plus, X } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { useBackend } from '@/components/backend';
import {
  linkAccountAction,
  linkedAccountsAction,
  switchAccountAction,
  unlinkAccountAction,
  buildingAccountLinksAction,
} from './invite';
// Account linking runs against real accounts, so the demo (base '/demo') shows neither of these.
export function LinkedAccounts() {
  return useBackend().base === '/demo' ? null : <AccountSwitcher />;
}
function AccountSwitcher() {
  const { base } = useBackend();
  const [open, setOpen] = useState(false),
    [links, setLinks] = useState<{ id: string; label: string; expires_at: string }[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="small"
        className="switch-account"
        aria-label="Switch account"
        onClick={async () => {
          setOpen(true);
          try {
            setLinks(await linkedAccountsAction());
          } catch {
            setError('Account links could not be loaded.');
          }
        }}
      >
        <ArrowRightLeft size={14} />
        <span className="switch-label">Switch account</span>
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Your linked accounts"
        description="Switch verified accounts. Documents and conversations never merge."
      >
        {links.map((l) => (
          <div className="activity-row" key={l.id}>
            <Link2 size={17} />
            <div>
              <h3>{l.label}</h3>
              <p>Link expires {l.expires_at.slice(0, 10)}</p>
            </div>
            <Button
              size="small"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                const r = await switchAccountAction(l.id);
                setBusy(false);
                if (r.ok) location.assign(base + '/workspace');
                else setError(r.error || 'Switch failed.');
              }}
            >
              Switch
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Unlink account"
              onClick={async () => {
                await unlinkAccountAction(l.id);
                setLinks(links.filter((x) => x.id !== l.id));
              }}
            >
              <X size={14} />
            </Button>
          </div>
        ))}
        <form
          className="form-stack"
          style={{ marginTop: 24 }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const r = await linkAccountAction({ email: f.get('email'), password: f.get('password') });
            setBusy(false);
            if (r.ok) setLinks(await linkedAccountsAction());
            else setError(r.error || 'Could not verify account.');
          }}
        >
          <h3 style={{ fontSize: 13 }}>Verify another account you control</h3>
          <label>
            Email
            <input name="email" type="email" required autoComplete="username" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autoComplete="current-password" />
          </label>
          <p className="form-note">
            Both accounts must already be verified. Passwords are used only to authenticate this link and are
            never stored by BylawIQ.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <Button busy={busy}>
            <Plus size={15} />
            Link account
          </Button>
        </form>
      </Modal>
    </>
  );
}
type AccountLink = {
  id: string;
  first_account: string;
  second_account: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
};
/** Org admin view of links involving this organization's accounts (PRD 3.3: visible to admins and revocable). */
export function OrgAccountLinks({ buildingId }: { buildingId: string }) {
  return useBackend().base === '/demo' ? null : <OrgAccountLinkList buildingId={buildingId} />;
}
function OrgAccountLinkList({ buildingId }: { buildingId: string }) {
  const [links, setLinks] = useState<AccountLink[]>([]),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    buildingAccountLinksAction(buildingId)
      .then(
        (r) => {
          if (!cancelled) {
            setLinks(r);
            setError('');
          }
        },
        () => {
          if (!cancelled) setError('Linked accounts could not be loaded.');
        },
      )
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [buildingId, version]);
  if (loaded && !links.length && !error) return null;
  return (
    <div className="card" style={{ marginTop: 25 }}>
      <h3>Linked accounts</h3>
      <p className="form-note">
        People can link accounts they control to switch between them. Linking never merges documents or
        conversations. Revoke a link to stop switching.
      </p>
      {links.map((l) => (
        <div className="activity-row" key={l.id}>
          <Link2 size={17} />
          <div>
            <h3>
              {l.first_account} and {l.second_account}
            </h3>
            <p>
              {l.revoked_at ? 'Revoked ' + l.revoked_at.slice(0, 10) : 'Expires ' + l.expires_at.slice(0, 10)}
            </p>
          </div>
          {!l.revoked_at && (
            <Button
              size="small"
              variant="ghost"
              onClick={async () => {
                try {
                  await unlinkAccountAction(l.id);
                  setVersion((v) => v + 1);
                } catch {
                  setError('The link could not be revoked. Refresh and try again.');
                }
              }}
            >
              Revoke
            </Button>
          )}
        </div>
      ))}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
