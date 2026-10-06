import { describe, it, expect } from 'vitest';
import { seed } from '@/mock/store';
import { IDS } from '@/mock/data';
import { accessibleBuildings, visibleDocuments, can, isLinkedMember } from '@/mock/rules';
describe('mock rules', () => {
  it('scopes a resident to only their building', () => {
    const s = seed();
    const buildings = accessibleBuildings(s, IDS.users.priya);
    expect(buildings.map((b) => b.id)).toEqual([IDS.buildings.seaside]);
  });
  it('shows a resident only owner-visible documents', () => {
    const s = seed();
    const docs = visibleDocuments(s, IDS.users.priya, IDS.buildings.seaside);
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => d.owner_visible === true)).toBe(true);
    expect(docs.length).toBeLessThan(
      s.documents.filter((d) => d.building_id === IDS.buildings.seaside).length,
    );
  });
  it('gives the strata manager access to every linked building but not the unlinked one', () => {
    const s = seed();
    const ids = accessibleBuildings(s, IDS.users.sarah)
      .map((b) => b.id)
      .sort();
    expect(ids).toEqual([IDS.buildings.harbour, IDS.buildings.marina, IDS.buildings.seaside].sort());
    expect(ids).not.toContain(IDS.buildings.parkside);
  });
  it('denies chat to a resident', () => {
    const s = seed();
    expect(can(s, IDS.users.priya, 'chat.use', IDS.buildings.seaside)).toBe(false);
  });
  it('lets a building manager link a firm', () => {
    const s = seed();
    expect(can(s, IDS.users.james, 'building.link_firm', IDS.buildings.seaside)).toBe(true);
  });
  it('lets a portfolio manager act on a firm review', () => {
    const s = seed();
    expect(can(s, IDS.users.sarah, 'review.act', IDS.buildings.seaside)).toBe(true);
  });
  it('identifies firm staff as linked members, not the building manager', () => {
    const s = seed();
    expect(isLinkedMember(s, IDS.users.sarah, IDS.buildings.seaside)).toBe(true);
    expect(isLinkedMember(s, IDS.users.james, IDS.buildings.seaside)).toBe(false);
  });
});
