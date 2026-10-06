'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  Bell,
  FileText,
  FilePen,
  FolderOpen,
  Lightbulb,
  MessageSquare,
  PauseCircle,
  Reply,
} from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import { pretty } from '@/lib/constants';
import type { ResidentData } from '../types';
import { shortDate } from '@/lib/dates';
import { CreditHistory, CreditsCard, creditWord } from './credits-card';
/** Priya's home: what she can spend, what she can do with it, what changed in her building's bylaws, and her
 * building's owner documents. Every tool shows its price up front. */
export function ResidentHome({ data }: { data: ResidentData }) {
  const { base } = useBackend();
  const root = `${base}/b/${data.building.id}`;
  const p = data.prices;
  const tools: [string, string, string, ReactNode, string][] = [
    [
      'ask',
      'Ask BylawIQ',
      data.wallet.freeLeft > 0 ? `${data.wallet.freeLeft} free left` : creditWord(p.question),
      <MessageSquare key="a" size={18} />,
      'Ask anything about your building’s bylaws. Answers quote your owner documents and the law.',
    ],
    [
      'explainers',
      'Bylaw explainers',
      'Included',
      <Lightbulb key="e" size={18} />,
      'Every bylaw and rule shared with owners, in plain language.',
    ],
    [
      'draft',
      'Draft a notice to council',
      creditWord(p.draftNotice),
      <FilePen key="d" size={18} />,
      'Turn a problem into a clear letter that quotes the bylaws.',
    ],
    [
      'reply',
      'Reply to a strata letter',
      creditWord(p.letterReply),
      <Reply key="r" size={18} />,
      'Understand a letter you received and draft a reply.',
    ],
  ];
  return (
    <>
      <PageHeading
        eyebrow={[data.unit ? `UNIT ${data.unit}` : null, data.building.name.toUpperCase()]
          .filter(Boolean)
          .join(' · ')}
        title={`Hi ${data.firstName}.`}
        description="Your building’s bylaws, explained — and help writing to council when you need it."
      />
      <div className="split-grid dash-split">
        <section className="dash-section" aria-label="Credits">
          <CreditsCard data={data} />
        </section>
        <section className="dash-section" aria-labelledby="alerts-heading">
          <div className="card">
            <div className="card-title-row">
              <h2 id="alerts-heading" className="card-heading">
                Bylaw alerts
              </h2>
              <Badge>{data.alerts.length}</Badge>
            </div>
            {data.alerts.length ? (
              data.alerts.slice(0, 3).map((a) => (
                <div key={a.id} className="activity-row">
                  <span className="file-icon">
                    <Bell size={15} aria-hidden />
                  </span>
                  <div>
                    <h3>{a.title}</h3>
                    <p>{a.body}</p>
                  </div>
                  <time dateTime={a.at}>{shortDate(a.at)}</time>
                </div>
              ))
            ) : (
              <p className="form-note">
                No bylaw changes yet. You’ll see them here as soon as council brings one into force.
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="section-title">
        <h2 id="tools-heading">Your tools</h2>
        {!data.aiOn && <Badge tone="warning">Paused by BylawIQ</Badge>}
      </div>
      {data.aiOn ? (
        <nav aria-labelledby="tools-heading" className="tool-grid">
          {tools.map(([slug, label, price, icon, note]) => (
            <Link key={slug} href={`${root}/${slug}`} className="card tool-card">
              <span className="attention-icon" aria-hidden>
                {icon}
              </span>
              <span className="tool-text">
                <strong>{label}</strong>
                <small>{note}</small>
              </span>
              <Badge tone={price === 'Included' || price.endsWith('free left') ? 'green' : 'ai'}>
                {price}
              </Badge>
            </Link>
          ))}
        </nav>
      ) : (
        <Empty
          icon={<PauseCircle />}
          title="AI help is paused"
          description="BylawIQ has paused Ask, explainers and drafting for residents. Your credits, drafts and documents are safe."
        />
      )}
      <div className="split-grid dash-split">
        <section className="dash-section" aria-labelledby="docs-heading">
          <div className="section-title">
            <h2 id="docs-heading">Owner documents</h2>
            <Link className="more-link" href={root + '/documents'}>
              All documents
            </Link>
          </div>
          <div className="card">
            {data.documents.length ? (
              data.documents.slice(0, 4).map((d) => (
                <Link key={d.id} className="activity-row" href={root + '/documents'}>
                  <span className="file-icon">
                    <FileText size={15} aria-hidden />
                  </span>
                  <div>
                    <h3>{d.title}</h3>
                    <p>
                      {pretty(d.type)} · {shortDate(d.at)}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="form-note">Your building hasn’t shared any documents with owners yet.</p>
            )}
          </div>
        </section>
        <section className="dash-section" aria-labelledby="drafts-heading">
          <div className="section-title">
            <h2 id="drafts-heading">My drafts</h2>
            <Link className="more-link" href={root + '/my-drafts'}>
              All drafts
            </Link>
          </div>
          <div className="card">
            {data.drafts.length ? (
              data.drafts.slice(0, 3).map((d) => (
                <Link key={d.id} className="activity-row" href={root + '/my-drafts'}>
                  <span className="file-icon">
                    <FolderOpen size={15} aria-hidden />
                  </span>
                  <div>
                    <h3>{d.title}</h3>
                    <p>Private to you · {shortDate(d.createdAt)}</p>
                  </div>
                </Link>
              ))
            ) : (
              <p className="form-note">Letters you draft are saved here, private to you.</p>
            )}
          </div>
        </section>
      </div>
      <div className="section-title">
        <h2>Recent credit activity</h2>
        <Link className="more-link" href={root + '/credits'}>
          Credit history
        </Link>
      </div>
      <CreditHistory entries={data.history} limit={5} />
    </>
  );
}
