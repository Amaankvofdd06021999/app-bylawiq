'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Bell,
  CircleAlert,
  CircleCheck,
  FilePen,
  KeyRound,
  MessageSquare,
  Scale,
  Upload,
} from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import { pretty } from '@/lib/constants';
import type { BuildingManagerData, DraftStatus } from '../types';
import { HealthBadge, Meter, MoreLink, Section, date, money, plural } from './parts';
const statusLabel = (s: DraftStatus, reviewBy: string, firm: string | null): [string, string] =>
  s === 'pending_review'
    ? [reviewBy === 'firm' ? `With ${firm ?? 'your firm'} for review` : 'Waiting for review', 'blue']
    : s === 'changes_requested'
      ? ['Changes requested', 'warning']
      : s === 'approved'
        ? ['Approved · ready to send', 'green']
        : s === 'sent'
          ? ['Sent', 'neutral']
          : ['Draft', 'neutral'];
/** James's morning: is the building in good shape, where his drafts stand with the firm, what council needs,
 * and whether he has room for more people. `firmCard` is the firm-links StrataManagementCard, rendered by the page. */
export function BuildingManagerDashboard({
  data,
  firmCard,
}: {
  data: BuildingManagerData;
  firmCard?: ReactNode;
}) {
  const { base } = useBackend();
  const root = `${base}/b/${data.building.id}`;
  const b = data.building,
    c = data.can,
    p = data.plan;
  const actions: [boolean, string, string, ReactNode, string][] = [
    [
      c.draft,
      'Draft a notice',
      'notices',
      <FilePen key="d" size={18} />,
      'Start a notice or letter from your bylaws',
    ],
    [c.ask, 'Ask a question', 'ask', <MessageSquare key="a" size={18} />, 'Answers cite your own documents'],
    [
      c.upload,
      'Upload a document',
      'documents',
      <Upload key="u" size={18} />,
      'Minutes, bylaws, insurance and more',
    ],
  ];
  const shown = actions.filter((a) => a[0]);
  const seatsFull = p.seatsIncluded > 0 && p.seatsUsed >= p.seatsIncluded;
  return (
    <>
      <PageHeading
        eyebrow="BUILDING HOME"
        title={b.name}
        description={
          [b.strataPlan, b.address, b.units ? `${b.units} units` : null].filter(Boolean).join(' · ') ||
          'Add the building details in settings.'
        }
        action={
          c.draft && (
            <Link className="button button-primary" href={root + '/notices'}>
              <FilePen size={16} />
              Draft a notice
            </Link>
          )
        }
      />
      {shown.length > 0 && (
        <nav aria-label="Quick actions" className="quick-actions">
          {shown.map(([, label, section, icon, note]) => (
            <Link key={section} href={`${root}/${section}`} className="card quick-action">
              <span className="attention-icon" aria-hidden>
                {icon}
              </span>
              <span>
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
            </Link>
          ))}
        </nav>
      )}
      <div className="split-grid dash-split">
        <Section id="health" title="Building health" action={<HealthBadge health={data.health} />}>
          <div className="card">
            <div className="health-list" style={{ marginTop: 0 }}>
              {data.health.checks.map((x) => (
                <div key={x.label}>
                  {x.ok ? (
                    <CircleCheck size={15} aria-hidden />
                  ) : (
                    <CircleAlert size={15} aria-hidden className="icon-warn" />
                  )}
                  <span>{x.label}</span>
                  <span>{x.detail}</span>
                </div>
              ))}
            </div>
            {data.health.issues.length > 0 && (
              <ul className="issue-list">
                {data.health.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            )}
          </div>
        </Section>
        <Section id="plan" title="Plan and seats">
          <div className="card">
            <div className="price-line">
              <strong>{p.billedBy ? p.label : `${p.label} plan`}</strong>
            </div>
            {p.billedBy ? (
              <p className="form-note">Your building’s seats are covered by {p.billedBy}.</p>
            ) : (
              <p className="price">
                {money(p.price)}
                <small>/month</small>
              </p>
            )}
            {p.seatsIncluded > 0 && (
              <>
                <p className="form-note">
                  {p.seatsUsed} of {plural(p.seatsIncluded, 'seat')} used · residents don’t use a seat
                </p>
                <Meter used={p.seatsUsed} total={p.seatsIncluded} label="Seats used" />
                {seatsFull && (
                  <p className="inline-callout" style={{ marginTop: 12 }}>
                    All seats are in use. Adding another council member or staff person needs one more seat.
                  </p>
                )}
              </>
            )}
          </div>
        </Section>
      </div>
      <Section
        id="drafts"
        title="Drafts and reviews"
        count={data.drafts.length}
        action={c.draft && <MoreLink href={root + '/notices'}>All notices</MoreLink>}
      >
        {data.drafts.length ? (
          <div className="resource-table">
            <table>
              <thead>
                <tr>
                  <th>Draft</th>
                  <th>Status</th>
                  <th className="hide-mobile">Type</th>
                  <th className="hide-mobile">Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.drafts.map((d) => {
                  const [label, tone] = statusLabel(d.status, d.reviewBy, data.firmName);
                  return (
                    <tr key={d.id}>
                      <td>
                        <Link className="cell-link" href={root + '/notices'}>
                          <strong>{d.title}</strong>
                        </Link>
                        {d.note && <small className="cell-sub">“{d.note}”</small>}
                      </td>
                      <td>
                        <Badge tone={tone}>{label}</Badge>
                      </td>
                      <td className="hide-mobile">{pretty(d.kind)}</td>
                      <td className="hide-mobile">{date(d.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<FilePen />}
            title="No drafts in progress"
            description="Notices and letters you draft appear here with where they are in review."
          />
        )}
      </Section>
      <div className="split-grid dash-split">
        <Section
          id="council"
          title="Council tasks"
          count={data.council.updates.length + data.council.disputes.length}
        >
          <div className="card">
            {data.council.updates.length === 0 && data.council.disputes.length === 0 ? (
              <p className="form-note">No unread updates or open disputes.</p>
            ) : (
              <>
                {data.council.updates.map((u) => (
                  <div key={u.id} className="activity-row">
                    <span className="file-icon">
                      <Bell size={15} />
                    </span>
                    <div>
                      <h3>{u.title}</h3>
                      <p>Unread update{u.severity === 'warning' ? ' · needs action' : ''}</p>
                    </div>
                    <time dateTime={u.at}>{date(u.at)}</time>
                  </div>
                ))}
                {data.council.disputes.map((d) => (
                  <div key={d.id} className="activity-row">
                    <span className="file-icon">
                      <Scale size={15} />
                    </span>
                    <div>
                      <h3>{d.title}</h3>
                      <p>
                        {d.reference} · {pretty(d.stage)}
                        {d.deadline ? ` · ${d.deadlineLabel ?? 'Deadline'} ${date(d.deadline)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
                <div className="action-line" style={{ marginTop: 12 }}>
                  {data.council.updates.length > 0 && <MoreLink href={root + '/updates'}>Updates</MoreLink>}
                  {data.council.disputes.length > 0 && (
                    <MoreLink href={root + '/disputes'}>Disputes</MoreLink>
                  )}
                </div>
              </>
            )}
          </div>
        </Section>
        <Section id="residents" title="Residents">
          <div className="card">
            <dl className="kv-grid">
              <div>
                <dt>Residents on BylawIQ</dt>
                <dd>{data.residents.count}</dd>
              </div>
              <div>
                <dt>Units</dt>
                <dd>{b.units ?? '—'}</dd>
              </div>
            </dl>
            <p className="form-note" style={{ marginTop: 14 }}>
              <KeyRound size={13} aria-hidden /> Residents join with this code
            </p>
            <p
              className="join-code"
              aria-label={'Resident join code ' + data.residents.code.split('').join(' ')}
            >
              {data.residents.code}
            </p>
            <Badge>Demo code</Badge>
            {c.invite && (
              <div style={{ marginTop: 14 }}>
                <MoreLink href={root + '/members'}>Invite people</MoreLink>
              </div>
            )}
          </div>
        </Section>
      </div>
      {firmCard && (
        <div className="settings-grid" style={{ marginTop: 30, gridTemplateColumns: '1fr' }}>
          {firmCard}
        </div>
      )}
    </>
  );
}
