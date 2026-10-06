import { describe, it, expect, vi, beforeAll } from 'vitest';
// `mock/session.ts` reads/writes cookies via `next/headers`, which only works inside a real Next.js request
// scope. This fakes that cookie jar in memory so `startDemo`/`demoSession` behave the same way they do in
// the app, letting these tests act as each persona the way `app/demo/start/[persona]/route.ts` will (Task 6).
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
const { startDemo } = await import('@/mock/session');
const { IDS } = await import('@/mock/data');
const { seed } = await import('@/mock/store');
const api = await import('@/mock/api');
type PersonaId = 'platform' | 'owner' | 'strata' | 'building' | 'resident';
async function as<T>(persona: PersonaId, run: () => Promise<T>): Promise<T> {
  await startDemo(persona);
  return run();
}
const seaside = IDS.buildings.seaside;
beforeAll(() => {
  process.env.DEMO_MODE = 'on';
});
describe('mock api: gate', () => {
  it('404s when the demo is not enabled', async () => {
    process.env.DEMO_MODE = 'off';
    const res = await api.chatStop(new Request('http://x', { method: 'POST' }), {
      id: IDS.chats.jamesConversation,
    });
    expect(res.status).toBe(404);
    process.env.DEMO_MODE = 'on';
  });
  it('401s with no demo session', async () => {
    jar.clear();
    const res = await api.chatStop(new Request('http://x', { method: 'POST' }), {
      id: IDS.chats.jamesConversation,
    });
    expect(res.status).toBe(401);
  });
});
describe('mock api: upload', () => {
  const form = () => {
    const f = new FormData();
    f.set('buildingId', seaside);
    f.set('title', 'Move-in notes');
    f.set('type', 'other');
    f.set('knowledgeBaseId', '');
    f.set('effectiveDate', '');
    f.set('filingReference', '');
    f.set('consent', 'on');
    f.set('file', new File(['hello'], 'notes.txt', { type: 'text/plain' }));
    return f;
  };
  it('forbids a resident and accepts the building manager', async () => {
    const forbidden = await as('resident', () =>
      api.upload(new Request('http://x', { method: 'POST', body: form() })),
    );
    expect(forbidden.status).toBe(403);
    const ok = await as('building', () =>
      api.upload(new Request('http://x', { method: 'POST', body: form() })),
    );
    expect(ok.status).toBe(201);
    expect(typeof (await ok.json()).id).toBe('string');
  });
  it('puts an uploaded bylaws document into review with parsed sections', async () => {
    const bylaw = () => {
      const f = form();
      f.set('type', 'bylaws');
      f.set('title', 'Amendment · Balconies');
      return f;
    };
    const res = await as('building', () =>
      api.upload(new Request('http://x', { method: 'POST', body: bylaw() })),
    );
    const { id } = await res.json();
    // The cookie jar still points at the session `as('building',...)` just started, so this reads the very
    // store the handler above wrote into.
    const { getStore } = await import('@/mock/store');
    const { demoSession } = await import('@/mock/session');
    const store = getStore((await demoSession())!.sessionId);
    const doc = store.documents.find((d) => d.id === id);
    expect(doc).toMatchObject({ status: 'review', structure_confirmed: false });
  });
});
describe('mock api: sources', () => {
  it('creates a source document with a source_url', async () => {
    const res = await as('building', () =>
      api.sources(
        new Request('http://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            buildingId: seaside,
            title: 'City bylaw portal',
            url: 'https://example.com/bylaws',
            knowledgeBaseId: null,
            consent: true,
          }),
        }),
      ),
    );
    expect(res.status).toBe(201);
  });
  it('forbids a resident', async () => {
    const res = await as('resident', () =>
      api.sources(
        new Request('http://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            buildingId: seaside,
            title: 'x',
            url: 'https://example.com',
            knowledgeBaseId: null,
            consent: true,
          }),
        }),
      ),
    );
    expect(res.status).toBe(403);
  });
});
describe('mock api: download', () => {
  it('hides a non-owner-visible document from a resident and shows it to the building manager', async () => {
    const s = seed();
    const hidden = s.documents.find((d) => d.building_id === seaside && d.owner_visible === false);
    if (!hidden) throw new Error('fixture expects a non-owner-visible Seaside document');
    const asResident = await as('resident', () =>
      api.download(new Request('http://x'), { id: String(hidden.id) }),
    );
    expect(asResident.status).toBe(404);
    const asManager = await as('building', () =>
      api.download(new Request('http://x'), { id: String(hidden.id) }),
    );
    expect(asManager.status).toBe(200);
    const text = await asManager.text();
    expect(text.length).toBeGreaterThan(0);
    expect(asManager.headers.get('Content-Disposition')).toContain('attachment');
  });
});
describe('mock api: export', () => {
  it('exports an approved notice as a PDF with the linked firm letterhead', async () => {
    const res = await as('building', () =>
      api.exportArtifact(new Request('http://x'), { id: String(IDS.notices.seasideApproved) }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    const bytes = await res.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
describe('mock api: chat', () => {
  it("forbids a resident from posting to another user's chat", async () => {
    const res = await as('resident', () =>
      api.chat(
        new Request('http://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: IDS.chats.jamesConversation,
            message: {
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text: 'Can residents use visitor parking?' }],
            },
          }),
        }),
      ),
    );
    expect(res.status).toBe(403);
  });
  it('streams a grounded data-answer part for a question the seed documents cover', async () => {
    const res = await as('building', () =>
      api.chat(
        new Request('http://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: IDS.chats.jamesConversation,
            message: {
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text: 'Can I have a dog?' }],
            },
          }),
        }),
      ),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('data-answer');
    expect(text).toContain('Demo answer from sample documents.');
  });
});
describe('mock api: resident Ask and credits', () => {
  const ask = (id: string, text: string, layers?: string[]) =>
    api.chat(
      new Request('http://x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id,
          message: { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }] },
          ...(layers ? { layers } : {}),
        }),
      }),
    );
  async function residentStore() {
    const { getStore } = await import('@/mock/store');
    const { demoSession } = await import('@/mock/session');
    return getStore((await demoSession())!.sessionId);
  }
  async function residentChat() {
    const s = await residentStore();
    const { createChat } = await import('@/mock/mutations');
    const r = createChat(s, IDS.users.priya, { buildingId: seaside, scope: 'building' });
    if (!r.ok) throw new Error(r.error);
    return { s, id: r.id };
  }
  it('lets Priya ask, spends one credit and never streams firm sources', async () => {
    await startDemo('resident');
    const { s, id } = await residentChat();
    const before = s.wallets.find((w) => w.userId === IDS.users.priya)!.credits;
    const res = await ask(id, 'What is the fine for noise?');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('data-answer');
    expect(text).not.toContain('"kind":"firm"');
    expect(s.wallets.find((w) => w.userId === IDS.users.priya)!.credits).toBe(before - 1);
    expect(s.ledger.at(-1)).toMatchObject({ userId: IDS.users.priya, delta: -1, reason: 'question' });
  });
  it('uses a free question first when one is left', async () => {
    await startDemo('resident');
    const { s, id } = await residentChat();
    const w = s.wallets.find((x) => x.userId === IDS.users.priya)!;
    w.freeQuestionsUsed = 1;
    const credits = w.credits;
    expect((await ask(id, 'Can I have a dog?')).status).toBe(200);
    expect(w.credits).toBe(credits);
    expect(w.freeQuestionsUsed).toBe(2);
    expect(s.ledger.at(-1)).toMatchObject({ delta: 0, reason: 'free_question' });
  });
  it('refunds a paid or free question that ends with no grounding', async () => {
    await startDemo('resident');
    const { s, id } = await residentChat();
    const w = s.wallets.find((x) => x.userId === IDS.users.priya)!;
    const credits = w.credits,
      ledger = s.ledger.length;
    const res = await ask(id, 'asdkjf qwoeiru nonsense gibberish');
    expect(res.status).toBe(200);
    await res.text();
    expect(w.credits).toBe(credits);
    expect(s.ledger.length).toBe(ledger);
    w.freeQuestionsUsed = 1;
    await (await ask(id, 'asdkjf qwoeiru nonsense gibberish')).text();
    expect(w.freeQuestionsUsed).toBe(1);
    expect(s.ledger.length).toBe(ledger);
  });
  it('returns 402 paywall with no credits and saves nothing', async () => {
    await startDemo('resident');
    const { s, id } = await residentChat();
    Object.assign(
      s.wallets.find((x) => x.userId === IDS.users.priya)!,
      { credits: 0, freeQuestionsUsed: 2 },
    );
    const count = s.messages.length;
    const res = await ask(id, 'Can I have a dog?');
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: 'You’re out of credits.', code: 'paywall' });
    expect(s.messages.length).toBe(count);
  });
  it('forbids resident Ask when the platform flag is off', async () => {
    await startDemo('resident');
    const { s, id } = await residentChat();
    s.platform.flags.residentAi = false;
    expect((await ask(id, 'Can I have a dog?')).status).toBe(403);
  });
  it('never charges staff and honours the layers chips', async () => {
    const res = await as('strata', async () => {
      const s = await residentStore();
      const { createChat } = await import('@/mock/mutations');
      const r = createChat(s, IDS.users.sarah, { buildingId: seaside, scope: 'building' });
      if (!r.ok) throw new Error(r.error);
      return ask(r.id, 'What is the fine for noise?', ['legal']);
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"kind":"legal"');
    expect(text).not.toContain('"kind":"building"');
    expect(text).not.toContain('"kind":"firm"');
  });
});
describe('mock api: portfolio Ask', () => {
  it('answers Sarah’s portfolio noise question from at least two buildings, grouped separately', async () => {
    const { groupClaims } = await import('@/features/chat/group-claims');
    const { text, buildings } = await as('strata', async () => {
      const { getStore } = await import('@/mock/store');
      const { demoSession } = await import('@/mock/session');
      const { createChat } = await import('@/mock/mutations');
      const { accessibleBuildings } = await import('@/mock/rules');
      const s = getStore((await demoSession())!.sessionId);
      const buildings = accessibleBuildings(s, IDS.users.sarah);
      const r = createChat(s, IDS.users.sarah, {
        buildingId: seaside,
        scope: 'portfolio',
        buildingIds: buildings.map((b) => b.id),
      });
      if (!r.ok) throw new Error(r.error);
      const res = await api.chat(
        new Request('http://x', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: r.id,
            message: {
              id: crypto.randomUUID(),
              role: 'user',
              parts: [{ type: 'text', text: 'What are the noise rules?' }],
            },
          }),
        }),
      );
      expect(res.status).toBe(200);
      return { text: await res.text(), buildings };
    });
    const line = text.split('\n').find((l) => l.includes('"type":"data-answer"'))!;
    const { data } = JSON.parse(line.replace(/^data: /, ''));
    const own = data.sources.filter((x: { kind: string }) => x.kind === 'building');
    const ids = new Set(own.map((x: { buildingId: string }) => x.buildingId));
    expect(ids.size).toBeGreaterThanOrEqual(2);
    for (const id of ids) expect(buildings.some((b) => b.id === id)).toBe(true);
    expect(data.sources.filter((x: { kind: string }) => x.kind === 'legal').length).toBeLessThanOrEqual(1);
    expect(data.answer.answer.length).toBeLessThanOrEqual(6);
    const groups = groupClaims(data.answer.answer, data.sources, buildings, seaside).filter(
      (g) => g.kind === 'building',
    );
    expect(groups.length).toBe(ids.size);
    expect(new Set(groups.map((g) => g.heading)).size).toBe(groups.length);
    expect(groups[0].heading).toBe('What Seaside Towers’ bylaws and documents say');
  });
});
describe('mock api: chat stop/stream', () => {
  it('returns 204 for both', async () => {
    const stop = await as('building', () =>
      api.chatStop(new Request('http://x', { method: 'POST' }), { id: IDS.chats.jamesConversation }),
    );
    expect(stop.status).toBe(204);
    const stream = await as('building', () =>
      api.chatStream(new Request('http://x'), { id: IDS.chats.jamesConversation }),
    );
    expect(stream.status).toBe(204);
  });
});
