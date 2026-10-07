import { createClient } from '@/lib/supabase/server';
import type { BulletinPost, BulletinFeedParams } from './bulletin-schema';

/**
 * Get bulletin posts for a building (paginated, pinned first)
 */
export async function getBulletinFeed({
  buildingId,
  limit = 20,
  offset = 0,
}: BulletinFeedParams): Promise<BulletinPost[]> {
  const db = await createClient();

  const { data, error } = await db
    .from('bulletin_posts')
    .select(
      `
      id,
      building_id,
      title,
      body,
      author_id,
      pinned,
      deleted_at,
      created_at,
      updated_at,
      author:profiles(display_name)
    `
    )
    .eq('building_id', buildingId)
    .is('deleted_at', null) // Exclude soft-deleted posts
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    buildingId: row.building_id,
    title: row.title,
    body: row.body,
    authorId: row.author_id,
    authorName: row.author?.display_name || 'Anonymous',
    pinned: row.pinned,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get a single bulletin post by ID
 */
export async function getBulletinPost(postId: string): Promise<BulletinPost | null> {
  const db = await createClient();

  const { data, error } = await db
    .from('bulletin_posts')
    .select(
      `
      id,
      building_id,
      title,
      body,
      author_id,
      pinned,
      deleted_at,
      created_at,
      updated_at,
      author:profiles(display_name)
    `
    )
    .eq('id', postId)
    .is('deleted_at', null)
    .single();

  if (error) return null;

  return {
    id: data.id,
    buildingId: data.building_id,
    title: data.title,
    body: data.body,
    authorId: data.author_id,
    authorName: data.author?.display_name || 'Anonymous',
    pinned: data.pinned,
    deletedAt: data.deleted_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get bulletin post count for a building
 */
export async function getBulletinPostCount(buildingId: string): Promise<number> {
  const db = await createClient();

  const { count, error } = await db
    .from('bulletin_posts')
    .select('id', { count: 'exact', head: true })
    .eq('building_id', buildingId)
    .is('deleted_at', null);

  if (error) return 0;
  return count || 0;
}
