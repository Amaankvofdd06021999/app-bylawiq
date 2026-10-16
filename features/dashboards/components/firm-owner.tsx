'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Building2, Users } from 'lucide-react';
import { Badge, Empty, PageHeading } from '@/components/ui';
import { useBackend } from '@/components/backend';
import type { FirmOwnerData } from '../types';
import { Section, Stat, date, plural } from './parts';

/**
 * The firm owner's home. Every figure comes from the database: the roster is the firm's building links, and the team
 * is its members. Sections without a source in the launch scope are not shown.
 */
export function FirmOwnerDashboard({ data, joinForm }: { data: FirmOwnerData; joinForm?: ReactNode }) {
  const { base } = useBackend();
  const linked = data.roster.filter((r) => r.linked).length;
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
                    <td>{p.role.replaceAll('_', ' ')}</td>
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
      {joinForm && <div style={{ marginTop: 32 }}>{joinForm}</div>}
    </div>
  );
}
