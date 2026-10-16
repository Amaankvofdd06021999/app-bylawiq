'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Building2, Users } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import {
  inviteFirmMemberAction,
  removeFirmMemberAction,
  revokeFirmInvitationAction,
} from '@/features/firm-team/actions';
import { FirmLibrary } from '@/features/firm-knowledge/components/firm-library';
import type { FirmOwnerData } from '../types';
import { Section, Stat, date, plural } from './parts';

const ROLE_LABELS: Record<string, string> = {
  org_owner: 'Owner',
  org_admin: 'Organization admin',
  portfolio_manager: 'Portfolio manager',
};

/**
 * The firm owner's home. Every figure comes from the database. The team controls (invite, revoke, remove) are shown
 * only on the live home; the demo has no live team to change.
 */
export function FirmOwnerDashboard({
  data,
  joinForm,
  reviewInbox,
}: {
  data: FirmOwnerData;
  joinForm?: ReactNode;
  reviewInbox?: ReactNode;
}) {
  const { base } = useBackend();
  const router = useRouter();
  const live = base === '';
  const linked = data.roster.filter((r) => r.linked).length;

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'portfolio_manager' | 'org_admin'>('portfolio_manager');
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [teamError, setTeamError] = useState('');
  const [busy, setBusy] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setTeamError('');
    const result = await inviteFirmMemberAction({ firmOrgId: data.firm.id, email, role });
    setBusy(false);
    if (result.ok) {
      setLink({ email: result.email, url: result.url });
      setEmail('');
      router.refresh();
    } else setTeamError(result.error);
  }

  async function revoke(invitationId: string) {
    setBusy(true);
    setTeamError('');
    const result = await revokeFirmInvitationAction({ invitationId });
    setBusy(false);
    if (result.ok) router.refresh();
    else setTeamError(result.error);
  }

  async function remove(userId: string) {
    setBusy(true);
    setTeamError('');
    const result = await removeFirmMemberAction({ firmOrgId: data.firm.id, userId });
    setBusy(false);
    if (result.ok) router.refresh();
    else setTeamError(result.error);
  }

  return (
    <div className="dashboard">
      <PageHeading
        title={`Welcome back, ${data.firstName}.`}
        description={`${data.firm.name}: buildings and team`}
      />
      <div className="stat-grid">
        <Stat
          label="Linked buildings"
          value={linked}
          note={plural(data.roster.length, 'building') + ' on record'}
        />
        <Stat label="Team" value={data.staff.length} note={plural(data.staff.length, 'person', 'people')} />
      </div>
      {reviewInbox}
      <Section id="roster" title="Building roster" count={data.roster.length}>
        {data.roster.length ? (
          <div className="resource-table">
            <table>
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Status</th>
                  <th className="hide-mobile">Linked since</th>
                </tr>
              </thead>
              <tbody>
                {data.roster.map((r) => (
                  <tr key={r.buildingId}>
                    <td>
                      {r.linked ? (
                        <Link className="cell-link" href={`${base}/b/${r.buildingId}/ask`}>
                          <strong>{r.name}</strong>
                        </Link>
                      ) : (
                        <strong>{r.name}</strong>
                      )}
                    </td>
                    <td>{r.linked ? <Badge tone="green">Linked</Badge> : <Badge>Not linked</Badge>}</td>
                    <td className="hide-mobile">{r.linked && r.since ? date(r.since) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Building2 />}
            title="No linked buildings"
            description="Buildings appear here once they give your firm a code and you join them."
          />
        )}
      </Section>
      <Section id="staff" title="Your team" count={data.staff.length}>
        {data.staff.length ? (
          <div className="resource-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  {live && <th aria-label="Actions" />}
                </tr>
              </thead>
              <tbody>
                {data.staff.map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <span className="cell-title">
                        <strong>{p.name || 'Unnamed member'}</strong>
                        {p.you && <Badge>You</Badge>}
                      </span>
                    </td>
                    <td>{ROLE_LABELS[p.role] ?? p.role.replaceAll('_', ' ')}</td>
                    {live && (
                      <td>
                        {!p.you && p.role !== 'org_owner' && (
                          <Button
                            variant="secondary"
                            size="small"
                            disabled={busy}
                            aria-label={`Remove ${p.name || 'member'} from the firm`}
                            onClick={() => remove(p.userId)}
                          >
                            Remove
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Users />}
            title="No team members yet"
            description="People in your firm appear here."
          />
        )}
      </Section>
      {live && (
        <Section id="invitations" title="Invite a team member">
          <form onSubmit={invite} className="form-stack">
            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="portfolio_manager">Portfolio manager</option>
                <option value="org_admin">Organization admin</option>
              </select>
            </label>
            <Button busy={busy}>Send invitation</Button>
          </form>
          {link && (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="form-note">
                Send this link to {link.email}. It works once, for that email address, and expires in 14 days.
              </p>
              <code aria-label="Invitation link" style={{ wordBreak: 'break-all' }}>
                {link.url}
              </code>
            </div>
          )}
          {data.teamInvitations && data.teamInvitations.length > 0 && (
            <div className="resource-table" style={{ marginTop: 20 }}>
              <table>
                <thead>
                  <tr>
                    <th>Pending invitation</th>
                    <th>Role</th>
                    <th className="hide-mobile">Expires</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.teamInvitations.map((i) => (
                    <tr key={i.id}>
                      <td>{i.email}</td>
                      <td>{ROLE_LABELS[i.role] ?? i.role}</td>
                      <td className="hide-mobile">{date(i.expiresAt)}</td>
                      <td>
                        <Button
                          variant="secondary"
                          size="small"
                          disabled={busy}
                          aria-label={`Revoke invitation for ${i.email}`}
                          onClick={() => revoke(i.id)}
                        >
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {teamError && (
            <p role="alert" className="form-error" style={{ marginTop: 12 }}>
              {teamError}
            </p>
          )}
        </Section>
      )}
      {live && <FirmLibrary firmId={data.firm.id} documents={data.firmDocuments ?? []} />}
      {joinForm && <div style={{ marginTop: 32 }}>{joinForm}</div>}
    </div>
  );
}
