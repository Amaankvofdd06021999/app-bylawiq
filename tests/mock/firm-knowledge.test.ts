import { describe, it, expect } from 'vitest';
import { seed } from '@/mock/store';
import { IDS } from '@/mock/data';
import { firmKnowledgeView, firmTabFor, saveFirmDoc, deleteFirmDoc } from '@/mock/mutations/firm-knowledge';
import { answer } from '@/mock/answers';
import { ForbiddenError } from '@/lib/errors';
const u = IDS.users,
  b = IDS.buildings,
  coastline = IDS.orgs.coastline;
const doc = {
  collection: 'policies' as const,
  title: 'Balcony noise courtesy letter',
  body: 'Send a courtesy letter about balcony noise before any s.135 step.\n\nKeep a note of the quiet hours bylaw the letter quotes.',
};

describe('firm knowledge view', () => {
  it('lists the four collections for firm staff, editable by the owner and managers only', () => {
    const s = seed();
    const dana = firmKnowledgeView(s, u.dana);
    expect(dana.firm).toEqual({ id: coastline, name: 'Coastline Strata Management' });
    expect(dana.collections.map((c) => c.label)).toEqual([
      'Templates & precedents',
      'Policies & procedures',
      'Guidance notes',
      'CRT & legislation tracker',
    ]);
    expect(dana.collections.flatMap((c) => c.docs).length).toBe(8);
    expect(dana.canEdit).toBe(true);
    expect(firmKnowledgeView(s, u.sarah).canEdit).toBe(true);
    expect(firmKnowledgeView(s, u.leeWong).canEdit).toBe(false);
  });
  it('is forbidden to building managers, residents and the platform admin', () => {
    const s = seed();
    for (const who of [u.james, u.priya, u.alex])
      expect(() => firmKnowledgeView(s, who)).toThrow(ForbiddenError);
  });
  it('offers the Firm tab only to linked firm staff on that building', () => {
    const s = seed();
    expect(firmTabFor(s, u.sarah, b.seaside)).toBe(true);
    expect(firmTabFor(s, u.leeWong, b.seaside)).toBe(true);
    expect(firmTabFor(s, u.james, b.seaside)).toBe(false);
    expect(firmTabFor(s, u.priya, b.seaside)).toBe(false);
    expect(firmTabFor(s, u.sarah, b.parkside)).toBe(false); // not linked to Coastline
  });
});

describe('managing firm documents', () => {
  it('lets the owner and managers add, edit and delete, rechunking the body', () => {
    const s = seed();
    const r = saveFirmDoc(s, u.dana, doc);
    if (!r.ok) throw new Error(r.error);
    expect(s.firmDocs.find((d) => d.id === r.id)).toMatchObject({
      orgId: coastline,
      collection: 'policies',
      title: doc.title,
      created_by: u.dana,
    });
    expect(s.firmChunks.filter((c) => c.docId === r.id).map((c) => c.sectionRef)).toEqual([
      'Part 1',
      'Part 2',
    ]);
    expect(saveFirmDoc(s, u.sarah, { ...doc, id: r.id, body: 'One paragraph about noise only.' })).toEqual({
      ok: true,
      id: r.id,
    });
    expect(s.firmChunks.filter((c) => c.docId === r.id).map((c) => c.content)).toEqual([
      'One paragraph about noise only.',
    ]);
    expect(deleteFirmDoc(s, u.sarah, { id: r.id })).toEqual({ ok: true });
    expect(s.firmDocs.some((d) => d.id === r.id)).toBe(false);
    expect(s.firmChunks.some((c) => c.docId === r.id)).toBe(false);
  });
  it('keeps assistants read-only and everyone outside the firm out', () => {
    const s = seed();
    const count = s.firmDocs.length;
    const existing = s.firmDocs[0].id;
    for (const who of [u.leeWong, u.james, u.priya, u.alex]) {
      expect(saveFirmDoc(s, who, doc)).toMatchObject({ ok: false });
      expect(saveFirmDoc(s, who, { ...doc, id: existing })).toMatchObject({ ok: false });
      expect(deleteFirmDoc(s, who, { id: existing })).toMatchObject({ ok: false });
    }
    expect(s.firmDocs.length).toBe(count);
  });
  it('asks for precedents to be anonymised', () => {
    const s = seed();
    expect(
      saveFirmDoc(s, u.dana, { ...doc, body: 'The owner of unit 1204 complained about noise twice.' }),
    ).toMatchObject({ ok: false });
    expect(
      saveFirmDoc(s, u.dana, { ...doc, body: 'Write to priya.nair@seasidetowers.example about the noise.' }),
    ).toMatchObject({ ok: false });
  });
  it('makes a new firm document answerable in Ask for firm staff, and never for building staff or residents', () => {
    const s = seed();
    const r = saveFirmDoc(s, u.dana, {
      collection: 'guidance',
      title: 'Elevator booking guidance',
      body: 'Remind owners to book the elevator early and to confirm the booking in writing.',
    });
    if (!r.ok) throw new Error(r.error);
    expect(
      answer(s, u.sarah, b.seaside, 'How should the elevator be booked?', ['firm']).sources.map(
        (x) => x.title,
      ),
    ).toContain('Elevator booking guidance');
    for (const who of [u.james, u.priya])
      expect(
        answer(s, who, b.seaside, 'How should the elevator be booked?').sources.some(
          (x) => x.kind === 'firm',
        ),
      ).toBe(false);
  });
});
