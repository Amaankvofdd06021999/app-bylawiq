'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, ClipboardCheck, Clock, Library, Mail, Receipt, Users } from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import type { FirmOwnerData } from '../types';
import { HealthBadge, Meter, MoreLink, Section, Stat, date, money, plural } from './parts';
/** Dana's morning: is the firm keeping up (reviews, turnaround), who is carrying what, which buildings need a
 * look, and what the firm pays. `joinForm` is the firm-links join form, rendered by the page. */
export function FirmOwnerDashboard({ data, joinForm }: { data: FirmOwnerData; joinForm?: ReactNode }) {
  const { base } = useBackend();
  const t = data.turnaround;
  const attention = data.roster.filter((r) => r.health.tone !== 'green').length;
  return (
    <>
      <PageHeading
        eyebrow={data.firm.name.toUpperCase()}
        title={`Welcome back, ${data.firstName}.`}
        description="How your firm, its people and its buildings are doing today."
      />
      <div className="stats-grid">
        <Stat
          label="Buildings managed"
          icon={<Building2 size={16} />}
          value={data.roster.length}
          note={attention ? `${plural(attention, 'building')} need a look` : 'All on track'}
        />
        <Stat
          label="Reviews waiting"
          icon={<ClipboardCheck size={16} />}
          value={t.waiting}
          note={t.oldest ? `Oldest waiting ${plural(t.oldest.days, 'day')}` : 'Nothing waiting'}
        />
        <Stat
          label="Median review time"
          icon={<Clock size={16} />}
          value={t.medianHours == null ? '—' : `${Math.round(t.medianHours)} h`}
          note={t.decided ? `Across ${plural(t.decided, 'decision')}` : 'No decisions yet'}
        />
        <Stat
          label="Seats in use"
          icon={<Users size={16} />}
          value={data.plan ? `${data.plan.seatsUsed} of ${data.plan.seatsIncluded}` : data.staff.length}
          note={data.plan?.label ?? 'No plan on file'}
        />
      </div>
      <Section id="staff" title="Your team" count={data.staff.length}>
        {data.staff.length ? (
          <div className="resource-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th className="hide-mobile">Buildings</th>
                  <th>Open reviews</th>
                  <th className="hide-mobile">Last active</th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((p) => (
                  <tr key={p.userId}>
                    <td>
                      <span className="cell-title">
                        <span className="avatar avatar-small" aria-hidden>
                          {p.name
                            .split(' ')
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join('')}
                        </span>
                        <strong>{p.name}</strong>
                        {p.you && <Badge>You</Badge>}
                      </span>
                    </td>
                    <td>{p.role}</td>
                    <td className="hide-mobile">{p.buildings}</td>
                    <td>{p.openReviews ? <Badge tone="blue">{p.openReviews}</Badge> : '—'}</td>
                    <td className="hide-mobile">{p.lastActive ? date(p.lastActive) : 'No activity yet'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            icon={<Users />}
            title="No staff yet"
            description="People you add to the firm appear here with the buildings they work on."
          />
        )}
      </Section>
      <Section id="roster" title="Building roster" count={data.roster.length}>
        {data.roster.length ? (
          <div className="resource-table">
            <table>
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Health</th>
                  <th className="hide-mobile">Linked since</th>
                  <th className="hide-mobile">Open disputes</th>
                  <th>Reviews waiting</th>
                </tr>
              </thead>
              <tbody>
                {data.roster.map((r) => (
                  <tr key={r.buildingId}>
                    <td>
                      <Link className="cell-link" href={`${base}/b/${r.buildingId}/ask`}>
                        <strong>{r.name}</strong>
                      </Link>
                      {r.health.issues[0] && <small className="cell-sub">{r.health.issues[0]}</small>}
                    </td>
                    <td>
                      <HealthBadge health={r.health} />
                    </td>
                    <td className="hide-mobile">{r.linked ? date(r.since) : 'Not linked'}</td>
                    <td className="hide-mobile">{r.openDisputes || '—'}</td>
                    <td>{r.pendingReviews || '—'}</td>
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
      <div className="split-grid dash-split">
        <Section id="turnaround" title="Review turnaround">
          <div className="card">
            <dl className="kv-grid">
              <div>
                <dt>Median time to decide</dt>
                <dd>{t.medianHours == null ? '—' : `${Math.round(t.medianHours)} hours`}</dd>
              </div>
              <div>
                <dt>Waiting now</dt>
                <dd>{t.waiting}</dd>
              </div>
            </dl>
            {t.oldest ? (
              <div className="inline-callout" style={{ marginTop: 16 }}>
                <strong>Oldest waiting:</strong> {t.oldest.title} · {t.oldest.buildingName} ·{' '}
                {plural(t.oldest.days, 'day')}{' '}
                <MoreLink href={`${base}/b/${t.oldest.buildingId}/notices`}>Open</MoreLink>
              </div>
            ) : (
              <p className="form-note" style={{ marginTop: 16 }}>
                No drafts are waiting for your firm’s review.
              </p>
            )}
          </div>
        </Section>
        <Section id="plan" title="Plan and billing">
          {data.plan ? (
            <div className="card">
              <div className="price-line">
                <strong>{data.plan.label}</strong>
                {data.plan.launchDiscount && <Badge tone="ai">Launch price</Badge>}
                {data.plan.status === 'trial' && <Badge tone="blue">Trial</Badge>}
              </div>
              <p className="price">
                {data.plan.launchDiscount && data.plan.listPrice > data.plan.price && (
                  <s className="list-price">{money(data.plan.listPrice)}</s>
                )}{' '}
                {money(data.plan.price)}
                <small>/month</small>
              </p>
              <p className="form-note">
                {plural(data.plan.seatsUsed, 'seat')} used of {data.plan.seatsIncluded} · covers{' '}
                {plural(data.plan.buildings, 'linked building')}
              </p>
              <Meter used={data.plan.seatsUsed} total={data.plan.seatsIncluded} label="Seats used" />
            </div>
          ) : (
            <Empty
              icon={<Receipt />}
              title="No plan on file"
              description="Your firm’s plan and price appear here once billing is set up."
            />
          )}
        </Section>
      </div>
      <div className="split-grid dash-split">
        <Section
          id="firm-knowledge"
          title="Firm knowledge"
          count={plural(data.knowledge.total, 'document')}
          action={
            data.knowledge.buildingId && (
              <MoreLink href={`${base}/b/${data.knowledge.buildingId}/knowledge?tab=firm`}>Manage</MoreLink>
            )
          }
        >
          <div className="card">
            <p className="form-note">
              Internal practice for your staff only — never shown to building managers, council or residents.
            </p>
            <ul className="plain-list">
              {data.knowledge.collections.map((c) => (
                <li key={c.id}>
                  <Library size={15} aria-hidden />
                  <span>{c.label}</span>
                  <Badge>{c.count}</Badge>
                </li>
              ))}
            </ul>
            <p className="form-note">Last updated {date(data.knowledge.lastUpdated)}</p>
          </div>
        </Section>
        <Section
          id="invitations"
          title="Invitations and join codes"
          count={data.invitations.length + data.codes.length}
        >
          <div className="card">
            {data.invitations.length || data.codes.length ? (
              <ul className="plain-list" style={{ marginTop: 0 }}>
                {data.invitations.map((i) => (
                  <li key={i.id}>
                    <Mail size={15} aria-hidden />
                    <span>
                      <strong>{i.email}</strong>
                      <small className="cell-sub">
                        {i.role} · {i.buildingName} · expires {date(i.expiresAt)}
                      </small>
                    </span>
                  </li>
                ))}
                {data.codes.map((c) => (
                  <li key={c.id}>
                    <Clock size={15} aria-hidden />
                    <span>
                      <strong>Firm code for {c.buildingName}</strong>
                      <small className="cell-sub">Unused · expires {date(c.expiresAt)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="form-note">No invitations or codes are waiting.</p>
            )}
          </div>
        </Section>
      </div>
      {joinForm && <div style={{ marginTop: 30 }}>{joinForm}</div>}
    </>
  );
}
