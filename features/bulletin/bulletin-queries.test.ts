import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getBulletinFeed, getBulletinPost, getBulletinPostCount } from './bulletin-queries';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

type Result = { data: unknown; error: unknown; count?: number | null };
type Call = { op: string; args: unknown[] };

// Stand-in for the Supabase query builder: every filter is recorded, and the chain resolves to the given result.
function fakeDb(result: Result, calls: Call[]) {
  const builder: Record<string, unknown> = {};
  const chain =
    (op: string) =>
    (...args: unknown[]) => {
      calls.push({ op, args });
      return builder;
    };
  Object.assign(builder, {
    select: chain('select'),
    eq: chain('eq'),
    is: chain('is'),
    order: chain('order'),
    range: chain('range'),
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (value: Result) => unknown) => resolve(result),
  });
  return { from: () => builder };
}

const buildingId = '11111111-1111-4111-8111-111111111111';
const postRow = {
  id: 'post-1',
  building_id: buildingId,
  title: 'Water shut off',
  body: 'Tuesday 9am to noon.',
  author_id: 'user-1',
  pinned: true,
  deleted_at: null,
  created_at: '2026-10-01T10:00:00Z',
  updated_at: '2026-10-01T10:00:00Z',
  author: { display_name: 'John Doe' },
};

describe('Bulletin queries', () => {
  let calls: Call[];

  function useDb(result: Result) {
    calls = [];
    vi.mocked(createClient).mockResolvedValue(fakeDb(result, calls) as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getBulletinFeed', () => {
    it('maps rows and names the author', async () => {
      useDb({ data: [postRow], error: null });
      const posts = await getBulletinFeed({ buildingId, limit: 20, offset: 0 });
      expect(posts).toEqual([
        {
          id: 'post-1',
          buildingId,
          title: 'Water shut off',
          body: 'Tuesday 9am to noon.',
          authorId: 'user-1',
          authorName: 'John Doe',
          pinned: true,
          deletedAt: null,
          createdAt: '2026-10-01T10:00:00Z',
          updatedAt: '2026-10-01T10:00:00Z',
        },
      ]);
    });

    it('limits to one building, hides soft-deleted posts, and orders pinned first', async () => {
      useDb({ data: [], error: null });
      await getBulletinFeed({ buildingId, limit: 20, offset: 0 });
      expect(calls).toContainEqual({ op: 'eq', args: ['building_id', buildingId] });
      expect(calls).toContainEqual({ op: 'is', args: ['deleted_at', null] });
      expect(calls).toContainEqual({ op: 'order', args: ['pinned', { ascending: false }] });
      expect(calls).toContainEqual({ op: 'order', args: ['created_at', { ascending: false }] });
    });

    it('pages with the requested offset and limit', async () => {
      useDb({ data: [], error: null });
      await getBulletinFeed({ buildingId, limit: 10, offset: 30 });
      expect(calls).toContainEqual({ op: 'range', args: [30, 39] });
    });

    it('surfaces a database error instead of returning an empty feed', async () => {
      useDb({ data: null, error: new Error('boom') });
      await expect(getBulletinFeed({ buildingId, limit: 20, offset: 0 })).rejects.toThrow('boom');
    });

    it('names an author who has no profile', async () => {
      useDb({ data: [{ ...postRow, author: null }], error: null });
      const [post] = await getBulletinFeed({ buildingId, limit: 20, offset: 0 });
      expect(post.authorName).toBe('Anonymous');
    });
  });

  describe('getBulletinPost', () => {
    it('returns the post by id', async () => {
      useDb({ data: postRow, error: null });
      const post = await getBulletinPost('post-1');
      expect(post?.title).toBe('Water shut off');
      expect(calls).toContainEqual({ op: 'eq', args: ['id', 'post-1'] });
    });

    it('returns null when the post is missing or soft-deleted', async () => {
      useDb({ data: null, error: { code: 'PGRST116' } });
      expect(await getBulletinPost('missing')).toBeNull();
    });

    it('excludes soft-deleted posts', async () => {
      useDb({ data: postRow, error: null });
      await getBulletinPost('post-1');
      expect(calls).toContainEqual({ op: 'is', args: ['deleted_at', null] });
    });
  });

  describe('getBulletinPostCount', () => {
    it('counts only active posts in the building', async () => {
      useDb({ data: null, error: null, count: 4 });
      expect(await getBulletinPostCount(buildingId)).toBe(4);
      expect(calls).toContainEqual({ op: 'eq', args: ['building_id', buildingId] });
      expect(calls).toContainEqual({ op: 'is', args: ['deleted_at', null] });
    });

    it('is zero for a building with no posts', async () => {
      useDb({ data: null, error: null, count: null });
      expect(await getBulletinPostCount(buildingId)).toBe(0);
    });
  });
});
