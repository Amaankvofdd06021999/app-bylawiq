'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import {
  CreateBulletinPostSchema,
  UpdateBulletinPostSchema,
  PinBulletinPostSchema,
  DeleteBulletinPostSchema,
} from './bulletin-schema';

/**
 * Create a bulletin post (staff only)
 * Requires: bulletin.post permission
 */
export async function createBulletinPostAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = CreateBulletinPostSchema.parse(raw);

    const db = await createClient();

    // Verify user can post to this building
    const { data: member, error: memberError } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    checkDb(memberError);

    if (!member) {
      throw new ForbiddenError('You are not a member of this building');
    }

    // Check permission (only staff, not residents)
    if (member.role === 'owner_resident') {
      throw new ForbiddenError('Residents cannot post to bulletin');
    }

    // Create post
    const { data: post, error: createError } = await db
      .from('bulletin_posts')
      .insert({
        building_id: input.buildingId,
        title: input.title,
        body: input.body,
        author_id: user.id,
        pinned: false,
      })
      .select()
      .single();

    checkDb(createError);

    return { ok: true, postId: post.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Update a bulletin post (author or building manager only)
 */
export async function updateBulletinPostAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = UpdateBulletinPostSchema.parse(raw);

    const db = await createClient();

    // Get the post
    const { data: post, error: getError } = await db
      .from('bulletin_posts')
      .select('author_id, building_id')
      .eq('id', input.postId)
      .eq('building_id', input.buildingId)
      .is('deleted_at', null)
      .single();

    checkDb(getError);

    // Verify authorization (author or manager)
    if (post.author_id !== user.id) {
      const { data: member } = await db
        .from('building_members')
        .select('role')
        .eq('building_id', input.buildingId)
        .eq('user_id', user.id)
        .single();

      if (!member || member.role === 'owner_resident' || member.role === 'council_member') {
        throw new ForbiddenError('You can only edit your own posts');
      }
    }

    // Update post
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (input.title) updateData.title = input.title;
    if (input.body) updateData.body = input.body;

    const { error: updateError } = await db
      .from('bulletin_posts')
      .update(updateData)
      .eq('id', input.postId)
      .eq('building_id', input.buildingId);

    checkDb(updateError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Pin or unpin a bulletin post (building manager only)
 */
export async function pinBulletinPostAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = PinBulletinPostSchema.parse(raw);

    const db = await createClient();

    // Verify user can manage building posts
    const { data: member, error: memberError } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    checkDb(memberError);

    if (!member || member.role === 'owner_resident' || member.role === 'council_member') {
      throw new ForbiddenError('Only building managers can pin posts');
    }

    // Update pin status
    const { error: updateError } = await db
      .from('bulletin_posts')
      .update({ pinned: input.pinned })
      .eq('id', input.postId)
      .eq('building_id', input.buildingId);

    checkDb(updateError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Delete (soft delete) a bulletin post (author or building manager only)
 */
export async function deleteBulletinPostAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = DeleteBulletinPostSchema.parse(raw);

    const db = await createClient();

    // Get the post
    const { data: post, error: getError } = await db
      .from('bulletin_posts')
      .select('author_id, building_id')
      .eq('id', input.postId)
      .eq('building_id', input.buildingId)
      .is('deleted_at', null)
      .single();

    checkDb(getError);

    // Verify authorization
    if (post.author_id !== user.id) {
      const { data: member } = await db
        .from('building_members')
        .select('role')
        .eq('building_id', input.buildingId)
        .eq('user_id', user.id)
        .single();

      if (!member || member.role === 'owner_resident' || member.role === 'council_member') {
        throw new ForbiddenError('You can only delete your own posts');
      }
    }

    // Soft delete
    const { error: deleteError } = await db
      .from('bulletin_posts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.postId)
      .eq('building_id', input.buildingId);

    checkDb(deleteError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
