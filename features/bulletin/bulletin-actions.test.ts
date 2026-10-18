import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createBulletinPostAction,
  updateBulletinPostAction,
  pinBulletinPostAction,
  deleteBulletinPostAction,
} from './bulletin-actions';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/auth/guards', () => ({
  requireUser: vi.fn(),
}));

// The bulletin is off for launch, and its gate is tested in tests/launch-scope.test.ts. These tests check the feature's
// own rules, so they run with the feature switched on.
vi.mock('@/lib/launch-scope', () => ({
  requireLaunchFeature: () => undefined,
  launchFeatureEnabled: () => true,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/errors', () => ({
  checkDb: (error: unknown) => {
    if (error) throw error;
  },
  ForbiddenError: class ForbiddenError extends Error {},
  NotFoundError: class NotFoundError extends Error {
    constructor(message = 'Not found') {
      super(message);
    }
  },
  errorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.'),
}));

type Result = { data: unknown; error: unknown };
type Call = { table: string; op: string; args: unknown[] };

// A small stand-in for the Supabase query builder. Each table answers with the result given for it; every call is
// recorded so a test can check what was written.
function fakeDb(results: Record<string, Result>, calls: Call[]) {
  return {
    from(table: string) {
      const result = results[table] ?? { data: null, error: null };
      const builder = {
        select: (...args: unknown[]) => record(table, 'select', args),
        eq: (...args: unknown[]) => record(table, 'eq', args),
        is: (...args: unknown[]) => record(table, 'is', args),
        insert: (...args: unknown[]) => record(table, 'insert', args),
        update: (...args: unknown[]) => record(table, 'update', args),
        single: async () => result,
        maybeSingle: async () => result,
      };
      function record(t: string, op: string, args: unknown[]) {
        calls.push({ table: t, op, args });
        return builder;
      }
      return builder;
    },
  };
}

const buildingId = '11111111-1111-4111-8111-111111111111';
const postId = '22222222-2222-4222-8222-222222222222';

describe('Bulletin actions', () => {
  let calls: Call[];

  function useDb(results: Record<string, Result>) {
    calls = [];
    vi.mocked(createClient).mockResolvedValue(fakeDb(results, calls) as never);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue({ id: 'user-1', email: 'test@example.com' } as never);
  });

  describe('createBulletinPostAction', () => {
    const input = { buildingId, title: 'Water shut off', body: 'Tuesday 9am to noon.' };

    it('refuses residents', async () => {
      useDb({ building_members: { data: { role: 'owner_resident' }, error: null } });
      const r = await createBulletinPostAction(input);
      expect(r).toEqual({ ok: false, error: 'Residents cannot post to bulletin' });
      expect(calls.some((c) => c.op === 'insert')).toBe(false);
    });

    it('refuses someone who is not a member of the building', async () => {
      useDb({ building_members: { data: null, error: null } });
      const r = await createBulletinPostAction(input);
      expect(r).toEqual({ ok: false, error: 'You are not a member of this building' });
    });

    it('lets staff post, recording the author and building', async () => {
      useDb({
        building_members: { data: { role: 'building_manager' }, error: null },
        bulletin_posts: { data: { id: postId }, error: null },
      });
      const r = await createBulletinPostAction(input);
      expect(r).toEqual({ ok: true, postId });
      const insert = calls.find((c) => c.table === 'bulletin_posts' && c.op === 'insert');
      expect(insert?.args[0]).toMatchObject({ building_id: buildingId, author_id: 'user-1', pinned: false });
    });

    it('rejects invalid input before touching the database', async () => {
      useDb({});
      const r = await createBulletinPostAction({ ...input, buildingId: 'not-a-uuid' });
      expect(r.ok).toBe(false);
      expect(calls).toHaveLength(0);
    });
  });

  describe('updateBulletinPostAction', () => {
    it('lets the author edit their own post', async () => {
      useDb({ bulletin_posts: { data: { author_id: 'user-1', building_id: buildingId }, error: null } });
      const r = await updateBulletinPostAction({ postId, buildingId, title: 'Corrected' });
      expect(r).toEqual({ ok: true });
      expect(calls.some((c) => c.table === 'bulletin_posts' && c.op === 'update')).toBe(true);
    });

    it('refuses a resident editing someone else’s post', async () => {
      useDb({
        bulletin_posts: { data: { author_id: 'user-2', building_id: buildingId }, error: null },
        building_members: { data: { role: 'owner_resident' }, error: null },
      });
      const r = await updateBulletinPostAction({ postId, buildingId, title: 'Mine now' });
      expect(r).toEqual({ ok: false, error: 'You can only edit your own posts' });
    });

    it('reports a missing post as not found', async () => {
      useDb({ bulletin_posts: { data: null, error: null } });
      const r = await updateBulletinPostAction({ postId, buildingId, title: 'Gone' });
      expect(r.ok).toBe(false);
    });
  });

  describe('pinBulletinPostAction', () => {
    it('refuses residents', async () => {
      useDb({ building_members: { data: { role: 'owner_resident' }, error: null } });
      const r = await pinBulletinPostAction({ postId, buildingId, pinned: true });
      expect(r).toEqual({ ok: false, error: 'Only building managers can pin posts' });
    });

    it('lets a building manager pin a post', async () => {
      useDb({ building_members: { data: { role: 'building_manager' }, error: null } });
      const r = await pinBulletinPostAction({ postId, buildingId, pinned: true });
      expect(r).toEqual({ ok: true });
      const update = calls.find((c) => c.table === 'bulletin_posts' && c.op === 'update');
      expect(update?.args[0]).toEqual({ pinned: true });
    });
  });

  describe('deleteBulletinPostAction', () => {
    it('soft-deletes the post for its author', async () => {
      useDb({ bulletin_posts: { data: { author_id: 'user-1', building_id: buildingId }, error: null } });
      const r = await deleteBulletinPostAction({ postId, buildingId });
      expect(r).toEqual({ ok: true });
      const update = calls.find((c) => c.table === 'bulletin_posts' && c.op === 'update');
      expect(update?.args[0]).toHaveProperty('deleted_at');
    });

    it('refuses a resident deleting someone else’s post', async () => {
      useDb({
        bulletin_posts: { data: { author_id: 'user-2', building_id: buildingId }, error: null },
        building_members: { data: { role: 'owner_resident' }, error: null },
      });
      const r = await deleteBulletinPostAction({ postId, buildingId });
      expect(r).toEqual({ ok: false, error: 'You can only delete your own posts' });
    });
  });
});
