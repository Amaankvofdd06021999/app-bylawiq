import { describe, expect, it } from 'vitest';
import { isValidFilingReference, unfiledSeverity } from '@/lib/lto-filing';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-10-18T12:00:00Z');
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);

describe('unfiledSeverity: the escalation schedule (same boundaries as the database)', () => {
  it('is info for a notice a day old', () => {
    expect(unfiledSeverity(ago(1), NOW)).toBe('info');
  });

  it('is info just before 14 days', () => {
    expect(unfiledSeverity(new Date(NOW.getTime() - 14 * DAY + 1000), NOW)).toBe('info');
  });

  it('is warning at exactly 14 days', () => {
    expect(unfiledSeverity(ago(14), NOW)).toBe('warning');
  });

  it('is warning just before 60 days', () => {
    expect(unfiledSeverity(new Date(NOW.getTime() - 60 * DAY + 1000), NOW)).toBe('warning');
  });

  it('is critical at exactly 60 days', () => {
    expect(unfiledSeverity(ago(60), NOW)).toBe('critical');
  });

  it('accepts a timestamp string as it comes from the database', () => {
    expect(unfiledSeverity(ago(20).toISOString(), NOW)).toBe('warning');
  });
});

describe('isValidFilingReference: the database rule, applied after trimming', () => {
  it.each(['LTO-2026/1234', 'CA1234567', 'ab1', '  LTO-2026/1234  ', 'A-1/2'])('accepts %j', (ref) => {
    expect(isValidFilingReference(ref)).toBe(true);
  });

  it.each([
    ['AB', 'too short'],
    ['ABCDEF', 'no digit'],
    ['LTO 2026', 'a space inside'],
    ['-AB1', 'a leading hyphen'],
    ['A'.repeat(31) + '1', 'too long'],
    ['', 'empty'],
    ['   ', 'only spaces'],
    ['LTO#2026', 'a symbol'],
  ])('refuses %j (%s)', (ref) => {
    expect(isValidFilingReference(ref)).toBe(false);
  });

  it('refuses a missing value', () => {
    expect(isValidFilingReference(null)).toBe(false);
    expect(isValidFilingReference(undefined)).toBe(false);
  });
});
