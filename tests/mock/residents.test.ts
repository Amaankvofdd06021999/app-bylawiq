import { describe, it, expect, vi, beforeAll } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
const { seed } = await import('@/mock/store');
const { IDS } = await import('@/mock/data');
const { residentData, buyCredits, residentDraft, hasResidentHome } = await import('@/mock/residents');
const { mutate } = await import('@/mock/mutations');
const { startDemo } = await import('@/mock/session');
const { NotFoundError } = await import('@/lib/errors');
const u = IDS.users,
  b = IDS.buildings;
beforeAll(() => {
  process.env.DEMO_MODE = 'on';
});
const notice = {
  kind: 'notice_to_council' as const,
  buildingId: b.seaside,
  topic: 'Renovation noise on weekends',
  happened: 'The unit above mine started renovation noise at 7:30 am on two Saturdays in a row.',
  request: 'Please remind the owner of the weekend start time.',
};
const letter = {
  kind: 'letter_reply' as const,
  buildingId: b.seaside,
  letter:
    'Dear owner, we received a complaint about noise from your unit after 10:00 pm. Council may impose a fine of $200. Please respond within 14 days.',
  response: '',
};
// Every owner-visible Seaside passage, and every passage a resident must never see (other buildings, staff-only docs).
function passages(s: ReturnType<typeof seed>) {
  const visible = new Set(
    s.documents.filter((d) => d.building_id === b.seaside && d.owner_visible === true).map((d) => d.id),
  );
  const ok = s.chunks.filter((c) => visible.has(c.documentId)).map((c) => c.content);
  const firm = s.firmChunks.map((c) => c.content);
  return { ok, firm };
}

describe('resident home data', () => {
  it('shows Priya her credits, free questions, alerts, owner documents and history', () => {
    const d = residentData(seed(), u.priya, b.seaside);
    expect(d).toMatchObject({
      firstName: 'Priya',
      unit: '1204',
      aiOn: true,
      wallet: { credits: 87, freeLeft: 0, freeTotal: 2 },
      prices: { question: 1, draftNotice: 5, letterReply: 3, pack: { credits: 100, price: 20 } },
    });
    expect(d.alerts.map((a) => a.title)[0]).toBe('Electric vehicle charging bylaw is being drafted');
    expect(d.documents.map((x) => x.title)).toEqual(
      expect.arrayContaining(['Registered bylaws · Consolidated 2025', 'Building rules · Common areas']),
    );
    expect(d.documents.some((x) => /minutes|Insurance|Financial|Strata plan/.test(x.title))).toBe(false);
    expect(d.history[0].label).toBe('Question');
    expect(d.history.reduce((n, e) => n + e.delta, 0)).toBe(87);
    expect(d.drafts.map((x) => x.title)).toEqual(['Weekend renovation noise']);
  });
  it('explains each owner-visible bylaw and rule section, citing its passage word for word', () => {
    const s = seed();
    const d = residentData(s, u.priya, b.seaside);
    const { ok } = passages(s);
    expect(d.explainers.map((e) => e.sectionRef)).toEqual(['3.1', '3.2', '4.1', '4.4', 'R.2', 'R.6']);
    for (const e of d.explainers) {
      expect(ok).toContain(e.source.content);
      expect(e.source.kind).toBe('building');
      expect(e.summary.length).toBeGreaterThan(0);
    }
    const quiet = d.explainers.find((e) => e.sectionRef === '3.1')!;
    expect(quiet.label).toBe('Noise and quiet hours');
    expect(quiet.facts).toEqual(expect.arrayContaining(['10:00 pm', '7:00 am', '9:00 am']));
    expect(d.explainers.find((e) => e.sectionRef === 'R.6')!.label).toBe('Fines');
  });
  it('is only for residents of that building', () => {
    const s = seed();
    expect(() => residentData(s, u.james, b.seaside)).toThrow(NotFoundError);
    expect(() => residentData(s, u.priya, b.harbour)).toThrow(NotFoundError);
    expect(hasResidentHome(s, u.priya, b.seaside)).toBe(true);
    expect(hasResidentHome(s, u.james, b.seaside)).toBe(false);
  });
  it('keeps each resident’s drafts private to them', () => {
    const s = seed();
    s.residentDrafts.push({
      ...s.residentDrafts[0],
      id: crypto.randomUUID(),
      userId: u.james,
      title: 'Someone else’s draft',
    });
    expect(residentData(s, u.priya, b.seaside).drafts.map((x) => x.title)).toEqual([
      'Weekend renovation noise',
    ]);
  });
});

describe('buying credits', () => {
  it('adds 100 credits, records the purchase and counts the sale for the platform', () => {
    const s = seed();
    const month = new Date().toISOString().slice(0, 7);
    const sales = () =>
      s.platform.usage
        .filter((x) => x.building_id === b.seaside && x.month === month)
        .reduce((n, x) => n + Number(x.resident_credit_sales), 0);
    const before = sales();
    expect(buyCredits(s, u.priya, { buildingId: b.seaside })).toEqual({ ok: true, credits: 187 });
    expect(s.ledger.at(-1)).toMatchObject({ userId: u.priya, delta: 100, reason: 'purchase' });
    expect(sales()).toBe(before + 20);
  });
  it('is only for residents', () => {
    const s = seed();
    expect(buyCredits(s, u.james, { buildingId: b.seaside })).toMatchObject({ ok: false });
    expect(buyCredits(s, u.priya, { buildingId: b.harbour })).toMatchObject({ ok: false });
    expect(s.wallets.find((w) => w.userId === u.james)).toBeUndefined();
  });
});

describe('drafting a notice to council', () => {
  it('drafts from the cited owner-visible bylaws, charges 5 credits and saves it privately', () => {
    const s = seed();
    const { ok, firm } = passages(s);
    const r = residentDraft(s, u.priya, notice);
    if (!r.ok) throw new Error(r.error);
    expect(r.credits).toBe(82);
    expect(r.draft.body).toMatch(/^Dear members of council,/);
    expect(r.draft.body).toContain('Quiet hours run from 10:00 pm to 7:00 am.');
    expect(r.draft.body).toContain('Please remind the owner of the weekend start time.');
    expect(r.draft.body).toMatch(/Priya Nair\nUnit 1204$/);
    expect(r.draft.sources.length).toBeGreaterThan(0);
    for (const src of r.draft.sources) {
      expect(['building', 'legal']).toContain(src.kind);
      if (src.kind === 'building') expect(ok).toContain(src.content);
      expect(firm).not.toContain(src.content);
    }
    expect(s.residentDrafts.at(-1)).toMatchObject({
      userId: u.priya,
      buildingId: b.seaside,
      kind: 'notice_to_council',
    });
    expect(s.ledger.at(-1)).toMatchObject({ delta: -5, reason: 'draft_notice' });
  });
  it('never uses free questions', () => {
    const s = seed();
    const w = s.wallets.find((x) => x.userId === u.priya)!;
    w.freeQuestionsUsed = 0;
    w.credits = 5;
    expect(residentDraft(s, u.priya, notice).ok).toBe(true);
    expect(w).toMatchObject({ credits: 0, freeQuestionsUsed: 0 });
  });
  it('shows the paywall without saving anything when credits run short, and proceeds after buying', () => {
    const s = seed();
    s.wallets.find((x) => x.userId === u.priya)!.credits = 4;
    const drafts = s.residentDrafts.length,
      ledger = s.ledger.length;
    expect(residentDraft(s, u.priya, notice)).toMatchObject({ ok: false, paywall: true, credits: 4 });
    expect(s.residentDrafts.length).toBe(drafts);
    expect(s.ledger.length).toBe(ledger);
    buyCredits(s, u.priya, { buildingId: b.seaside });
    expect(residentDraft(s, u.priya, notice)).toMatchObject({ ok: true, credits: 99 });
  });
  it('refuses, without charging, when no owner-visible bylaw matches', () => {
    const s = seed();
    const r = residentDraft(s, u.priya, {
      ...notice,
      topic: 'Gardening club',
      happened: 'I would like to start a gardening club on the roof.',
      request: 'Please consider it.',
    });
    expect(r).toMatchObject({ ok: false });
    expect(s.wallets.find((x) => x.userId === u.priya)!.credits).toBe(87);
  });
  it('is closed to staff, other buildings and while resident AI is off', () => {
    const s = seed();
    expect(residentDraft(s, u.james, notice)).toMatchObject({ ok: false });
    expect(residentDraft(s, u.priya, { ...notice, buildingId: b.harbour })).toMatchObject({ ok: false });
    s.platform.flags.residentAi = false;
    expect(residentDraft(s, u.priya, notice)).toMatchObject({ ok: false });
    expect(s.wallets.find((x) => x.userId === u.priya)!.credits).toBe(87);
  });
});

describe('replying to a strata letter', () => {
  it('explains the letter against the bylaws and the law, drafts a reply and charges 3 credits', () => {
    const s = seed();
    const r = residentDraft(s, u.priya, letter);
    if (!r.ok) throw new Error(r.error);
    expect(r.credits).toBe(84);
    expect(r.draft.kind).toBe('letter_reply');
    expect(r.draft.meaning.some((m) => m.includes('Bylaw 3.1'))).toBe(true);
    expect(r.draft.meaning.some((m) => m.includes('$200') && m.includes('$100'))).toBe(true);
    expect(r.draft.meaning.some((m) => m.includes('s. 135'))).toBe(true);
    expect(r.draft.meaning.some((m) => m.includes('within 14 days'))).toBe(true);
    expect(r.draft.body).toMatch(/Priya Nair\nUnit 1204$/);
    expect(r.draft.sources.every((x) => x.kind === 'building' || x.kind === 'legal')).toBe(true);
    expect(s.ledger.at(-1)).toMatchObject({ delta: -3, reason: 'letter_reply' });
  });
});

describe('bylaw alerts', () => {
  it('adds an alert for residents when a bylaw version comes into force', () => {
    const s = seed();
    const v = s.versions.find((x) => x.building_id === b.seaside && x.status === 'draft')!;
    Object.assign(v, { status: 'filed', effective_date: '2026-01-01', filing_reference: 'LF-2026-1' });
    expect(
      mutate(s, u.james, {
        buildingId: b.seaside,
        operation: 'bylaw.transition',
        id: v.id,
        values: { status: 'in_force' },
      }),
    ).toEqual({ ok: true });
    expect(residentData(s, u.priya, b.seaside).alerts[0].title).toBe(
      'Electric vehicle charging (4.3) is now in force',
    );
  });
});

describe('resident pages', () => {
  it('lands Priya on her home, and keeps the resident sections for residents', async () => {
    const { default: BuildingPage } = await import('@/app/demo/b/[buildingId]/[section]/page');
    await startDemo('resident');
    const page = await BuildingPage({
      params: Promise.resolve({ buildingId: b.seaside, section: 'home' }),
      searchParams: Promise.resolve({}),
    });
    const { ResidentHome } = await import('@/features/residents/components/resident-home');
    expect((page as unknown as { props: { children: { type: unknown } } }).props.children.type).toBe(
      ResidentHome,
    );
    await startDemo('building');
    const digest = (p: Promise<unknown>) =>
      p.then(
        () => '',
        (e: unknown) => String((e as { digest?: unknown }).digest),
      );
    expect(
      await digest(
        BuildingPage({
          params: Promise.resolve({ buildingId: b.seaside, section: 'credits' }),
          searchParams: Promise.resolve({}),
        }),
      ),
    ).toMatch(/404/);
  });
});
