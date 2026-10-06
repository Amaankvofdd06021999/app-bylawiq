import { describe, it, expect } from 'vitest';
import { seed } from '@/mock/store';
import { IDS } from '@/mock/data';
import { layersFor, isFirmStaff, firmOf, canResidentAsk, isPlatformAdmin, can } from '@/mock/rules';
const { seaside, harbour, parkside } = IDS.buildings;
const { coastline, seasideOrg } = IDS.orgs;
describe('knowledge layers', () => {
  it('gives firm staff on a linked building all three layers, building first', () => {
    const s = seed();
    expect(layersFor(s, IDS.users.sarah, seaside)).toEqual(['building', 'firm', 'legal']);
    expect(layersFor(s, IDS.users.dana, seaside)).toEqual(['building', 'firm', 'legal']);
    expect(layersFor(s, IDS.users.leeWong, harbour)).toEqual(['building', 'firm', 'legal']);
  });
  it('never gives the building manager or the resident the firm layer', () => {
    const s = seed();
    expect(layersFor(s, IDS.users.james, seaside)).toEqual(['building', 'legal']);
    expect(layersFor(s, IDS.users.priya, seaside)).toEqual(['building', 'legal']);
    expect(layersFor(s, IDS.users.grace, seaside)).toEqual(['building', 'legal']); // council president
  });
  it('never gives council — president or member — the firm layer', () => {
    const s = seed();
    expect(layersFor(s, IDS.users.grace, seaside)).not.toContain('firm'); // council president
    expect(layersFor(s, IDS.users.ben, seaside)).not.toContain('firm'); // council member
    expect(layersFor(s, IDS.users.ben, seaside)).toEqual(['building', 'legal']);
  });
  it('gives nobody any layer on a building they are not a member of', () => {
    const s = seed();
    expect(layersFor(s, IDS.users.sarah, parkside)).toEqual([]);
    expect(layersFor(s, IDS.users.james, harbour)).toEqual([]);
    expect(layersFor(s, IDS.users.priya, harbour)).toEqual([]);
  });
  it('gives the platform admin no layer anywhere', () => {
    const s = seed();
    for (const b of s.buildings) expect(layersFor(s, IDS.users.alex, b.id)).toEqual([]);
  });
  it('drops the firm layer once the building unlinks from the firm', () => {
    const s = seed();
    for (const l of s.firmLinks) if (l.building_id === seaside) l.status = 'revoked';
    expect(layersFor(s, IDS.users.sarah, seaside)).not.toContain('firm');
  });
  it('drops the resident’s layers when the resident AI flag is off', () => {
    const s = seed();
    s.platform.flags.residentAi = false;
    expect(layersFor(s, IDS.users.priya, seaside)).toEqual([]);
    expect(layersFor(s, IDS.users.james, seaside)).toEqual(['building', 'legal']);
  });
});
describe('firm staff and platform admin', () => {
  it('recognises Coastline staff and nobody else', () => {
    const s = seed();
    for (const u of [IDS.users.dana, IDS.users.sarah, IDS.users.leeWong])
      expect(isFirmStaff(s, u, coastline)).toBe(true);
    for (const u of [IDS.users.james, IDS.users.priya, IDS.users.alex, IDS.users.omar])
      expect(isFirmStaff(s, u, coastline)).toBe(false);
    expect(isFirmStaff(s, IDS.users.james, seasideOrg)).toBe(false); // a building org is not a firm
  });
  it('stops recognising firm staff whose membership is no longer active', () => {
    const s = seed();
    for (const m of s.orgMembers) if (m.user_id === IDS.users.sarah) m.status = 'removed';
    expect(isFirmStaff(s, IDS.users.sarah, coastline)).toBe(false);
    expect(firmOf(s, IDS.users.sarah)).toBeNull();
  });
  it('names the firm a person works for', () => {
    const s = seed();
    expect(firmOf(s, IDS.users.sarah)).toBe(coastline);
    expect(firmOf(s, IDS.users.james)).toBeNull();
    expect(firmOf(s, IDS.users.alex)).toBeNull();
  });
  it('identifies only Alex as platform admin, with no building memberships', () => {
    const s = seed();
    expect(isPlatformAdmin(s, IDS.users.alex)).toBe(true);
    expect(isPlatformAdmin(s, IDS.users.dana)).toBe(false);
    expect(s.members.some((m) => m.user_id === IDS.users.alex)).toBe(false);
    expect(s.profiles.find((p) => p.id === IDS.users.alex)?.account_type).toBe('admin');
  });
  it('lets the resident ask on her own building only, without the real chat.use permission', () => {
    const s = seed();
    expect(canResidentAsk(s, IDS.users.priya, seaside)).toBe(true);
    expect(canResidentAsk(s, IDS.users.priya, harbour)).toBe(false);
    expect(canResidentAsk(s, IDS.users.james, seaside)).toBe(false);
    expect(can(s, IDS.users.priya, 'chat.use', seaside)).toBe(false);
  });
});
describe('seed', () => {
  it('stores firm knowledge for Coastline across all four collections, with chunks for every document', () => {
    const s = seed();
    expect(new Set(s.firmDocs.map((d) => d.collection))).toEqual(
      new Set(['templates', 'policies', 'guidance', 'legal_tracker']),
    );
    expect(s.firmDocs.every((d) => d.orgId === coastline)).toBe(true);
    for (const d of s.firmDocs)
      expect(s.firmChunks.some((c) => c.docId === d.id && c.orgId === d.orgId)).toBe(true);
    expect(s.firmDocs.some((d) => /\$200/.test(d.body) && /fine/i.test(d.title))).toBe(true);
  });
  it('keeps firm precedents anonymised: no seed person, unit or building names', () => {
    const s = seed();
    const names = [...s.profiles.map((p) => p.display_name), ...s.buildings.map((b) => b.name), '1204'];
    for (const d of s.firmDocs) for (const n of names) expect(d.title + ' ' + d.body).not.toContain(n);
  });
  it('caps Seaside’s noise fines at $100 in its own bylaws', () => {
    const s = seed();
    expect(
      s.chunks.some((c) => c.buildingId === seaside && /noise/i.test(c.content) && /\$100/.test(c.content)),
    ).toBe(true);
  });
  it('holds the Act sections and sample CRT decisions in the legal corpus', () => {
    const s = seed();
    for (const sec of ['26', '31', '130', '135', '141', '165'])
      expect(s.legalChunks.some((c) => c.source === 'act' && c.sectionRef === sec)).toBe(true);
    expect(s.legalChunks.filter((c) => c.source === 'crt').length).toBeGreaterThanOrEqual(2);
    expect(s.legalChunks.filter((c) => c.source === 'crt').every((c) => /sample/i.test(c.title))).toBe(true);
  });
  it('gives Priya 87 credits, 2 free questions used, and a ledger that adds up', () => {
    const s = seed();
    const w = s.wallets.find((x) => x.userId === IDS.users.priya);
    expect(w).toMatchObject({ buildingId: seaside, credits: 87, freeQuestionsUsed: 2 });
    const mine = s.ledger.filter((l) => l.userId === IDS.users.priya);
    expect(mine.some((l) => l.reason === 'purchase')).toBe(true);
    expect(mine.reduce((n, l) => n + l.delta, 0)).toBe(87);
    expect(mine.filter((l) => l.reason === 'free_question').length).toBe(2);
    expect(s.residentDrafts.some((d) => d.userId === IDS.users.priya)).toBe(true);
    expect(s.alerts.some((a) => a.buildingId === seaside)).toBe(true);
  });
  it('has platform plans and usage for every firm and building, and resident AI on', () => {
    const s = seed();
    for (const o of s.organizations) expect(s.platform.plans.some((p) => p.org_id === o.id)).toBe(true);
    for (const b of s.buildings) expect(s.platform.usage.some((u) => u.building_id === b.id)).toBe(true);
    expect(s.platform.flags.residentAi).toBe(true);
    expect(s.platform.audit.length).toBeGreaterThan(0);
  });
});
