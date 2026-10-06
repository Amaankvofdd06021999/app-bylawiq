'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Landmark,
  Library,
  Send,
  Sparkles,
  CircleCheck,
} from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import type { AttentionKind, StrataManagerData } from '../types';
import { HealthBadge, MoreLink, Section, plural } from './parts';
const KIND: Record<AttentionKind, { label: string; icon: ReactNode }> = {
  deadline: { label: 'Deadline', icon: <CalendarClock size={16} /> },
  review: { label: 'Review', icon: <ClipboardCheck size={16} /> },
  unsent: { label: 'Not sent', icon: <Send size={16} /> },
  law: { label: 'Law change', icon: <Landmark size={16} /> },
};
/** Sarah's morning: one list of what needs her today across every building, then each building at a glance.
 * `joinForm` and `reviewInbox` are the firm-links components, rendered by the page. */
export function StrataManagerDashboard({
  data,
  joinForm,
  reviewInbox,
}: {
  data: StrataManagerData;
  joinForm?: ReactNode;
  reviewInbox?: ReactNode;
}) {
  const { base } = useBackend();
  const n = data.needsAttention.length;
  const ask = data.askAcross && (
    <Link
      className="button button-primary"
      href={`${base}/b/${data.askAcross.buildingId}/ask?scope=portfolio`}
    >
      <Sparkles size={16} />
      Ask across buildings
    </Link>
  );
  return (
    <>
      <PageHeading
        eyebrow="Today"
        title={`Welcome back, ${data.firstName}.`}
        description={
          n
            ? `${plural(n, 'thing needs', 'things need')} you today across ${plural(data.buildings.length, 'building')}.`
            : `Nothing needs you right now across ${plural(data.buildings.length, 'building')}.`
        }
        action={ask}
      />
      <Section id="attention" title="Needs attention today" count={n}>
        {n ? (
          <ul className="card attention-list">
            {data.needsAttention.map((i) => (
              <li key={i.id} className="attention-row" data-tone={i.tone}>
                <span className="attention-icon" aria-hidden>
                  {KIND[i.kind].icon}
                </span>
                <div>
                  <div className="action-line">
                    <Badge tone={i.tone === 'neutral' ? 'neutral' : i.tone}>{KIND[i.kind].label}</Badge>
                    {i.buildingName && <small>{i.buildingName}</small>}
                  </div>
                  <h3>{i.title}</h3>
                  <p>{i.detail}</p>
                </div>
                {i.buildingId && (
                  <Link
                    className="button button-secondary button-small"
                    href={`${base}/b/${i.buildingId}/${i.section}${i.kind === 'law' ? '?tab=firm' : ''}`}
                    aria-label={`Open ${i.title}`}
                  >
                    Open
                    <ArrowUpRight size={13} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty
            icon={<CircleCheck />}
            title="You’re all caught up"
            description="Reviews, dispute deadlines, approved notices and law changes that need you will show up here."
          />
        )}
      </Section>
      <Section id="buildings" title="Your buildings" count={data.buildings.length}>
        {data.buildings.length ? (
          <div className="card-grid">
            {data.buildings.map((b) => (
              <Link key={b.id} href={`${base}/b/${b.id}/ask`} className="card agent-card">
                <div className="agent-card-top">
                  <span className="building-avatar">
                    <Building2 />
                  </span>
                  <HealthBadge health={b.health} />
                </div>
                <h3>{b.name}</h3>
                <p>
                  {b.health.issues.length
                    ? b.health.issues.slice(0, 2).join(' · ')
                    : 'Nothing waiting on this building.'}
                </p>
                <div className="agent-card-footer">
                  <span className="form-note">
                    {plural(b.reviews, 'review')} · {plural(b.disputes, 'dispute')} ·{' '}
                    {plural(b.drafts, 'draft')}
                  </span>
                  {b.updates > 0 && <Badge tone="blue">{b.updates} new</Badge>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            icon={<Building2 />}
            title="No buildings yet"
            description="Join a building with the code its manager gives you, below."
          />
        )}
      </Section>
      <div className="split-grid dash-split">
        <Section
          id="firm-knowledge"
          title="Firm knowledge"
          action={
            data.knowledge?.buildingId && (
              <MoreLink href={`${base}/b/${data.knowledge.buildingId}/knowledge?tab=firm`}>
                All collections
              </MoreLink>
            )
          }
        >
          {data.knowledge ? (
            <div className="card">
              <ul className="plain-list" style={{ marginTop: 0 }}>
                {data.knowledge.collections.map((c) => (
                  <li key={c.id}>
                    <Library size={15} aria-hidden />
                    <Link
                      className="cell-link"
                      href={`${base}/b/${data.knowledge!.buildingId}/knowledge?tab=firm&collection=${c.id}`}
                    >
                      {c.label}
                    </Link>
                    <Badge>{c.count}</Badge>
                  </li>
                ))}
              </ul>
              {data.knowledge.recent.length > 0 && (
                <>
                  <h3 className="card-subtitle">Recently updated</h3>
                  <ul className="plain-list">
                    {data.knowledge.recent.map((d) => (
                      <li key={d.id}>
                        <span>
                          <strong>{d.title}</strong>
                          <small className="cell-sub">{d.collection}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ) : (
            <Empty
              icon={<Library />}
              title="No firm knowledge"
              description="Your firm’s templates, procedures and guidance appear here once you work for a firm with linked buildings."
            />
          )}
        </Section>
        <Section id="ask-across" title="Ask across buildings">
          <div className="card">
            {data.askAcross ? (
              <>
                <p className="form-note">
                  Ask one question of every building you manage. Each answer is labelled by building, so you
                  never mix one building’s bylaws into another’s.
                </p>
                <p className="form-note" style={{ marginTop: 8 }}>
                  Covers {plural(data.askAcross.count, 'building')}. Single-building questions stay the
                  default.
                </p>
                <div style={{ marginTop: 16 }}>{ask}</div>
              </>
            ) : (
              <p className="form-note">
                Asking across buildings needs access to more than one building with portfolio questions
                allowed.
              </p>
            )}
          </div>
        </Section>
      </div>
      {joinForm && <div style={{ marginTop: 30 }}>{joinForm}</div>}
      {reviewInbox}
    </>
  );
}
