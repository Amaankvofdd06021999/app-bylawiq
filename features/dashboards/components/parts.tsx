'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui';
import { shortDate } from '@/lib/dates';
import type { Health } from '../types';
// Small building blocks shared by the role dashboards. Formatting is done by hand, not with Intl, so the server
// render and the browser always print the same text (no hydration mismatch across ICU versions).
export const date = shortDate;
export function money(n: number): string {
  const [whole, cents] = Math.abs(n).toFixed(2).split('.');
  return (
    (n < 0 ? '−$' : '$') + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (cents === '00' ? '' : '.' + cents)
  );
}
export function percent(n: number): string {
  return (Math.round(n * 1000) / 10).toFixed(1) + '%';
}
export const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export function Stat({
  label,
  icon,
  value,
  note,
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="card">
      <span className="stat-label">
        {label}
        {icon}
      </span>
      <div className="stat-value">{value}</div>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
export function HealthBadge({ health }: { health: Health }) {
  return (
    <Badge tone={health.tone === 'green' ? 'green' : health.tone === 'red' ? 'red' : 'warning'}>
      {health.label}
    </Badge>
  );
}
export function Section({
  id,
  title,
  count,
  action,
  children,
}: {
  id?: string;
  title: string;
  count?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  const heading = id ? id + '-heading' : undefined;
  return (
    <section id={id} aria-labelledby={heading} className="dash-section">
      <div className="section-title">
        <h2 id={heading}>{title}</h2>
        <div className="action-line">
          {count != null && <Badge>{count}</Badge>}
          {action}
        </div>
      </div>
      {children}
    </section>
  );
}
export function Meter({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div
      className="meter"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={used}
    >
      <span style={{ width: pct + '%' }} data-full={total > 0 && used >= total ? '' : undefined} />
    </div>
  );
}
export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="more-link">
      {children}
      <ArrowUpRight size={13} aria-hidden />
    </Link>
  );
}
