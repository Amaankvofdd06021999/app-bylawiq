/**
 * LTO filing rules as the screens see them. The database is the authority: transition_bylaw and the refresh function enforce the
 * same rules (supabase/migrations/20261046000062_lto_filing_tracking.sql). The boundaries here match the SQL and are tested
 * with the same values (tests/lto-filing.test.ts).
 *
 * Escalation schedule (proposed by product 2026-10-17; counsel to confirm):
 *   info      0 to 13 days after adoption
 *   warning   14 to 59 days
 *   critical  60 days or more
 */

export type UnfiledSeverity = 'info' | 'warning' | 'critical';

const DAY_MS = 24 * 60 * 60 * 1000;
export const UNFILED_WARNING_DAYS = 14;
export const UNFILED_CRITICAL_DAYS = 60;

/** The severity of an unfiled-filing notice at `now`, given when it was created. */
export function unfiledSeverity(createdAt: Date | string, now: Date = new Date()): UnfiledSeverity {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const ageMs = now.getTime() - created.getTime();
  if (ageMs >= UNFILED_CRITICAL_DAYS * DAY_MS) return 'critical';
  if (ageMs >= UNFILED_WARNING_DAYS * DAY_MS) return 'warning';
  return 'info';
}

/** A filing reference as the database accepts it, after trimming: 3 to 30 characters, letters, digits, hyphens and slashes, starting with a letter or digit, with at least one digit. */
export function isValidFilingReference(reference: string | null | undefined): boolean {
  if (typeof reference !== 'string') return false;
  const trimmed = reference.trim();
  return /^[A-Za-z0-9][A-Za-z0-9/-]{2,29}$/.test(trimmed) && /[0-9]/.test(trimmed);
}

export const FILING_REFERENCE_HINT =
  'Enter the LTO filing reference: 3 to 30 letters, digits, hyphens or slashes, with at least one digit.';
