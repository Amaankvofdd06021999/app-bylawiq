import { describe, expect, it } from 'vitest';
import { diffBylawText, type DiffSegment } from '@/lib/bylaw-diff';

// Rebuilds the old and new text from the segments. A correct diff loses nothing and invents nothing.
function rebuild(segments: DiffSegment[]) {
  const oldText = segments
    .filter((s) => s.kind !== 'added')
    .map((s) => s.text)
    .join('');
  const newText = segments
    .filter((s) => s.kind !== 'removed')
    .map((s) => s.text)
    .join('');
  return { oldText, newText };
}

describe('diffBylawText', () => {
  it('reports identical versions as one unchanged segment', () => {
    const d = diffBylawText('Quiet from 10 pm.', 'Quiet from 10 pm.');
    expect(d).toEqual({ segments: [{ kind: 'same', text: 'Quiet from 10 pm.' }], truncated: false });
  });

  it('marks a changed word as removed then added, with the rest unchanged', () => {
    const d = diffBylawText('Two pets per unit.', 'Three pets per unit.');
    expect(d.segments.filter((s) => s.kind === 'removed').map((s) => s.text)).toEqual(['Two']);
    expect(d.segments.filter((s) => s.kind === 'added').map((s) => s.text)).toEqual(['Three']);
    expect(d.truncated).toBe(false);
  });

  it('marks an inserted sentence as added', () => {
    const d = diffBylawText('Two pets per unit.', 'Two pets per unit. Council may approve a third.');
    const added = d.segments
      .filter((s) => s.kind === 'added')
      .map((s) => s.text)
      .join('');
    expect(added).toContain('Council may approve a third.');
    expect(d.segments.some((s) => s.kind === 'removed')).toBe(false);
  });

  it('rebuilds both inputs exactly, including spacing changes', () => {
    const oldText = 'Quiet  hours:\n10 pm to 7 am.';
    const newText = 'Quiet hours: 10 pm to 7 am, every day.';
    const d = diffBylawText(oldText, newText);
    expect(rebuild(d.segments)).toEqual({ oldText, newText });
  });

  it('handles an empty old version (a new section)', () => {
    const d = diffBylawText('', 'New section text.');
    expect(d.segments).toEqual([{ kind: 'added', text: 'New section text.' }]);
  });

  it('handles an empty new version (text removed)', () => {
    const d = diffBylawText('Old text.', '');
    expect(d.segments).toEqual([{ kind: 'removed', text: 'Old text.' }]);
  });

  it('returns no segments when both versions are empty', () => {
    expect(diffBylawText('', '')).toEqual({ segments: [], truncated: false });
  });

  it('falls back to a whole-body replacement when the diff is too large to compute', () => {
    const big = Array.from({ length: 3000 }, (_, i) => `word${i}`).join(' ');
    const other = Array.from({ length: 3000 }, (_, i) => `term${i}`).join(' ');
    const d = diffBylawText(big, other);
    expect(d.truncated).toBe(true);
    expect(d.segments).toEqual([
      { kind: 'removed', text: big },
      { kind: 'added', text: other },
    ]);
    expect(rebuild(d.segments)).toEqual({ oldText: big, newText: other });
  });
});
