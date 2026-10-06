import { describe, it, expect } from 'vitest';
import { seed } from '@/mock/store';
import { IDS } from '@/mock/data';
import { answer } from '@/mock/answers';
import { NO_GROUNDING } from '@/lib/ai/citations';
describe('mock answers', () => {
  it('cites the pets section for a dog question on Seaside', () => {
    const s = seed();
    const result = answer(s, IDS.users.james, IDS.buildings.seaside, 'Can I have a dog?');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources[0].sectionRef).toBe('3.2');
    expect(result.sources[0].buildingId).toBe(IDS.buildings.seaside);
    expect(result.sources[0].content).toContain('pets');
    expect(result.answer.answer[0].text.startsWith('Demo answer from sample documents.')).toBe(true);
    expect(result.answer.answer[0].evidence[0].quote).toBe(result.sources[0].content);
  });
  it('returns the no-grounding state for a nonsense question', () => {
    const s = seed();
    const result = answer(s, IDS.users.james, IDS.buildings.seaside, 'asdkjf qwoeiru nonsense gibberish');
    expect(result.sources).toEqual([]);
    expect(result.answer.answer).toEqual([]);
    expect(result.answer.limitations).toBe(NO_GROUNDING);
  });
  it('never cites a chunk from a different building', () => {
    const s = seed();
    const result = answer(s, IDS.users.dana, IDS.buildings.harbour, 'Can I have a dog?');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(
      result.sources
        .filter((x) => x.kind === 'building')
        .every((x) => x.buildingId === IDS.buildings.harbour),
    ).toBe(true);
    expect(result.sources.every((x) => x.kind === 'building' || x.buildingId === null)).toBe(true);
  });
});
describe('layered answers', () => {
  const seaside = IDS.buildings.seaside,
    q = 'What is the fine for noise?';
  const kinds = (r: ReturnType<typeof answer>) => new Set(r.sources.map((x) => x.kind));
  it('gives Sarah building, legal and firm sources on Seaside and names the $200 vs $100 conflict', () => {
    const r = answer(seed(), IDS.users.sarah, seaside, q);
    expect([...kinds(r)].sort()).toEqual(['building', 'firm', 'legal']);
    expect(r.sources.filter((x) => x.kind === 'building').every((x) => x.buildingId === seaside)).toBe(true);
    expect(r.sources.filter((x) => x.kind !== 'building').every((x) => x.buildingId === null)).toBe(true);
    expect(r.answer.limitations).toContain('$200');
    expect(r.answer.limitations).toContain('$100');
    expect(r.answer.limitations).toMatch(/bylaw governs/);
    expect(r.answer.answer.length).toBeLessThanOrEqual(6);
    expect(r.answer.answer.every((c) => c.text.startsWith('Demo answer from sample documents.'))).toBe(true);
    // Every claim cites sources of a single layer, so the UI can group it.
    for (const c of r.answer.answer)
      expect(new Set(c.evidence.map((e) => r.sources.find((x) => x.id === e.source)!.kind)).size).toBe(1);
  });
  it('never gives James (building manager) firm sources', () => {
    const r = answer(seed(), IDS.users.james, seaside, q);
    expect(kinds(r).has('firm')).toBe(false);
    expect(kinds(r).has('building')).toBe(true);
    expect(kinds(r).has('legal')).toBe(true);
  });
  it('never gives Priya (resident) firm sources, and only owner-visible building documents', () => {
    const s = seed();
    const r = answer(s, IDS.users.priya, seaside, q);
    expect(kinds(r).has('firm')).toBe(false);
    expect(r.sources.length).toBeGreaterThan(0);
    const visible = new Set(
      s.documents
        .filter((d) => d.building_id === seaside && d.owner_visible === true)
        .map((d) => String(d.title)),
    );
    for (const src of r.sources.filter((x) => x.kind === 'building'))
      expect(visible.has(src.title)).toBe(true);
    expect(answer(s, IDS.users.priya, seaside, q, ['firm']).sources).toEqual([]);
  });
  it('restricts the search to the requested layers', () => {
    const s = seed();
    expect([...kinds(answer(s, IDS.users.sarah, seaside, q, ['legal']))]).toEqual(['legal']);
    expect([...kinds(answer(s, IDS.users.sarah, seaside, q, ['firm']))]).toEqual(['firm']);
    expect([...kinds(answer(s, IDS.users.sarah, seaside, q, ['building']))]).toEqual(['building']);
    expect(answer(s, IDS.users.james, seaside, q, ['firm']).answer.limitations).toBe(NO_GROUNDING);
  });
  it('returns nothing for a person with no layers on the building', () => {
    const r = answer(seed(), IDS.users.alex, seaside, q);
    expect(r.answer.limitations).toBe(NO_GROUNDING);
  });
});
