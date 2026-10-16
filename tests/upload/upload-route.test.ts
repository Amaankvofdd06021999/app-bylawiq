// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BUILDING = '93000000-0000-4000-8000-00000000000a';

const state = vi.hoisted(() => ({
  calls: [] as string[],
  insertError: null as null | { message: string; code?: string },
  storageError: null as null | { message: string },
  sendError: null as null | Error,
}));

vi.mock('@/lib/auth/guards', () => ({
  requireUser: async () => ({
    id: '93000000-0000-4000-8000-000000000001',
    client: {
      storage: {
        from: () => ({
          upload: async () => {
            state.calls.push('storage.upload');
            return { error: state.storageError };
          },
          remove: async () => {
            state.calls.push('storage.remove');
            return { error: null };
          },
        }),
      },
      from: () => ({
        insert: async () => {
          state.calls.push('documents.insert');
          return { error: state.insertError };
        },
      }),
    },
  }),
  requirePermission: async () => undefined,
}));
vi.mock('@/lib/security/origin', () => ({ sameOrigin: () => undefined }));
vi.mock('@/lib/security/rate-limit', () => ({ rateLimit: async () => undefined }));
vi.mock('@/inngest/client', () => ({
  inngest: {
    send: async () => {
      state.calls.push('inngest.send');
      if (state.sendError) throw state.sendError;
    },
  },
}));

const { POST } = await import('@/app/api/upload/route');

function form(file: File) {
  const f = new FormData();
  f.set('buildingId', BUILDING);
  f.set('title', 'Pet rules');
  f.set('type', 'rules');
  f.set('knowledgeBaseId', '');
  f.set('effectiveDate', '2024-01-01');
  f.set('filingReference', '');
  f.set('consent', 'on');
  f.set('file', file);
  return f;
}

function request(file: File) {
  return new Request('http://127.0.0.1:3100/api/upload', { method: 'POST', body: form(file) });
}

const text = (content: string, name = 'rules.txt') =>
  new File([content.padEnd(200, ' ')], name, { type: 'text/plain' });

beforeEach(() => {
  state.calls = [];
  state.insertError = null;
  state.storageError = null;
  state.sendError = null;
});

describe('POST /api/upload', () => {
  it('stores the file first, then records the document, then queues indexing', async () => {
    const res = await POST(request(text('Pets are limited to two per unit.')));
    expect(res.status).toBe(201);
    expect(state.calls).toEqual(['storage.upload', 'documents.insert', 'inngest.send']);
    expect(((await res.json()) as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('removes the stored file when the document row cannot be written, so no orphan remains', async () => {
    state.insertError = { message: 'row rejected', code: '42501' };
    const res = await POST(request(text('Pets are limited to two per unit.')));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(state.calls).toEqual(['storage.upload', 'documents.insert', 'storage.remove']);
  });

  it('keeps the saved file and returns a retryable 503 when indexing cannot be queued', async () => {
    state.sendError = new Error('event API unreachable');
    const res = await POST(request(text('Pets are limited to two per unit.')));
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toMatch(
      /saved, but indexing did not start.*Retry/,
    );
    expect(state.calls).not.toContain('storage.remove');
  });

  it('refuses an unsupported file type before anything is stored', async () => {
    const res = await POST(request(new File(['MZ'], 'setup.exe', { type: 'application/octet-stream' })));
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it('refuses a PDF-named file that is not a PDF before anything is stored', async () => {
    const res = await POST(
      request(new File(['not really a pdf'.padEnd(200, ' ')], 'bylaws.pdf', { type: 'application/pdf' })),
    );
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it('refuses a file over the 4 MB limit before anything is stored', async () => {
    const big = new File([new Uint8Array(4 * 1024 * 1024 + 1)], 'big.txt', { type: 'text/plain' });
    const res = await POST(request(big));
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });
});
