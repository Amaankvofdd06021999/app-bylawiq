'use client';
import { useState } from 'react';
import { BookOpen, Lightbulb, Search } from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { DISCLAIMER } from '@/lib/constants';
import type { ResidentData } from '../types';
import { ToolPaused } from './draft-notice';
/** Plain-language explainers for each owner-visible bylaw and rule section. Every card shows the exact passage
 * it explains, so the resident can always check the summary against the bylaw itself. */
export function Explainers({ data }: { data: ResidentData }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = data.explainers.filter(
    (e) => !q || (e.label + ' ' + e.source.content + ' ' + e.sectionRef).toLowerCase().includes(q),
  );
  const heading = (
    <PageHeading
      eyebrow={data.building.name.toUpperCase()}
      title="Bylaw explainers"
      description={`What ${data.building.name}’s bylaws and rules mean for you, in plain language.`}
      action={<Badge tone="green">Included</Badge>}
    />
  );
  if (!data.aiOn)
    return (
      <>
        {heading}
        <ToolPaused />
      </>
    );
  return (
    <>
      {heading}
      <div className="toolbar">
        <div className="search-field">
          <Search size={16} aria-hidden />
          <input
            aria-label="Search explainers"
            placeholder="Search pets, parking, noise…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <span className="form-note">
          {shown.length} of {data.explainers.length} sections
        </span>
      </div>
      {!data.explainers.length ? (
        <Empty
          icon={<BookOpen />}
          title="No bylaws to explain yet"
          description="Explainers appear once your building shares its bylaws with owners."
        />
      ) : !shown.length ? (
        <Empty
          icon={<Search />}
          title="No sections match"
          description="Try another word, such as pets, parking or noise."
        />
      ) : (
        <div className="explainer-grid">
          {shown.map((e) => (
            <article key={e.id} className="card explainer-card" aria-labelledby={'ex-' + e.id}>
              <div className="agent-card-top">
                <span className="attention-icon" aria-hidden>
                  <Lightbulb size={17} />
                </span>
                <Badge>{e.sectionName}</Badge>
              </div>
              <h2 id={'ex-' + e.id} className="card-heading">
                {e.label}
              </h2>
              <h3 className="mini-heading">In plain terms</h3>
              <ul className="plain-bullets">
                {e.summary.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
              {e.facts.length > 0 && (
                <>
                  <h3 className="mini-heading">Key details</h3>
                  <p className="fact-chips">
                    {e.facts.map((f) => (
                      <span key={f}>{f}</span>
                    ))}
                  </p>
                </>
              )}
              <details className="source-details">
                <summary>Read the exact wording</summary>
                <blockquote>{e.source.content}</blockquote>
                <small>
                  {e.source.title} · section {e.sectionRef}
                </small>
              </details>
            </article>
          ))}
        </div>
      )}
      <p className="disclaimer">{DISCLAIMER}</p>
    </>
  );
}
