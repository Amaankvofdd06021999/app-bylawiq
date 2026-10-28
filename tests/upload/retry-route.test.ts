// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const BUILDING = '93000000-0000-4000-8000-00000000000a';
const DOC_ID = '93000000-0000-4000-8000-00000000000b';

const state = vi.hoisted(() => ({
  docStatus: 'failed',
  updatedAt: new Date().toISOString() as string | null,
  calls: [] as string[],
}));

vi.mock('@/lib/auth/guards', () => ({
  requireUser: async () => ({
    id: '93000000-0000-4000-8000-000000000001',
    client: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: DOC_ID,
                building_id: BUILDING,
                status: state.docStatus,
                updated_at: state.updatedAt,
              },
              error: null,
            }),
          }),
        }),
      }),
    },
  }),
  requirePermission: async () => undefined,
}));

vi.mock('@/lib/security/origin', () => ({ sameOrigin: () => undefined }));
vi.mock('@/inngest/client', () => ({
  inngest: {
    send: async () => {
      state.calls.push('inngest.send');
    },
  },
}));

const { POST } = await import('@/app/api/upload/retry/route');

function request(documentId: string) {
  return new Request('http://127.0.0.1:3100/api/upload/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId }),
  });
}

beforeEach(() => {
  state.calls = [];
  state.docStatus = 'failed';
  state.updatedAt = new Date().toISOString();
});

describe('POST /api/upload/retry', () => {
  it('allows retry for failed documents', async () => {
    state.docStatus = 'failed';
    const res = await POST(request(DOC_ID));
    expect(res.status).toBe(200);
    expect(state.calls).toEqual(['inngest.send']);
  });

  it('blocks retry for documents actively scanning to prevent duplicate runs', async () => {
    state.docStatus = 'scanning';
    state.updatedAt = new Date().toISOString(); // active right now
    const res = await POST(request(DOC_ID));
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });

  it('allows retry for stranded documents stuck in scanning for more than 15 minutes', async () => {
    state.docStatus = 'scanning';
    state.updatedAt = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago
    const res = await POST(request(DOC_ID));
    expect(res.status).toBe(200);
    expect(state.calls).toEqual(['inngest.send']);
  });

  it('allows retry for uploaded documents', async () => {
    state.docStatus = 'uploaded';
    const res = await POST(request(DOC_ID));
    expect(res.status).toBe(200);
    expect(state.calls).toEqual(['inngest.send']);
  });

  it('rejects retry for documents already in review or ready status', async () => {
    state.docStatus = 'review';
    const res = await POST(request(DOC_ID));
    expect(res.status).toBe(400);
    expect(state.calls).toEqual([]);
  });
});
