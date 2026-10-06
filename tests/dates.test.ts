import { describe, it, expect } from 'vitest';
import { shortDate } from '@/lib/dates';
describe('shortDate', () => {
  it('formats a date or timestamp by its calendar day', () => {
    expect(shortDate('2026-09-27')).toBe('Sep 27, 2026');
    expect(shortDate('2026-01-05T23:59:00Z')).toBe('Jan 5, 2026');
  });
  it('shows a dash for a missing or malformed value', () => {
    for (const v of [null, undefined, '', 'soon', '2026-13-01']) expect(shortDate(v)).toBe('—');
  });
});
