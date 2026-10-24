'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Document Scoping Actions
 * Control which documents residents can see
 */

const SetDocumentVisibilitySchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  buildingId: z.string().uuid('Invalid building ID'),
  ownerVisible: z.boolean(),
});

/**
 * Set document visibility for residents
 * Only staff can modify visibility
 */
export async function setDocumentVisibilityAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SetDocumentVisibilitySchema.parse(raw);

    const db = await createClient();

    // Verify user is staff in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can modify document visibility');
    }

    // Update document visibility
    const { error: updateError } = await db
      .from('documents')
      .update({
        owner_visible: input.ownerVisible,
      })
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId);

    checkDb(updateError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get resident-visible documents in a building
 * Residents can only see documents marked owner_visible
 */
export async function getResidentVisibleDocuments(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ buildingId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify user is a resident in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role !== 'owner_resident') {
      throw new ForbiddenError('Residents can only see documents in their building');
    }

    // Get only owner-visible documents
    const { data: documents, error } = await db
      .from('documents')
      .select('id, title, type, created_at')
      .eq('building_id', input.buildingId)
      .eq('owner_visible', true)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    checkDb(error);

    return {
      ok: true,
      documents: (documents || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        document_type: d.type,
        created_at: d.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get all documents with visibility status (staff view)
 */
export async function getDocumentVisibilityStatus(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ buildingId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify user is staff in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can view document visibility settings');
    }

    // Get all documents with visibility status
    const { data: documents, error } = await db
      .from('documents')
      .select(
        `
      id,
      title,
      type,
      owner_visible,
      status,
      created_at
    `,
      )
      .eq('building_id', input.buildingId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    checkDb(error);

    return {
      ok: true,
      documents: (documents || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        document_type: d.type,
        owner_visible: d.owner_visible,
        status: d.status,
        created_at: d.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get documents by visibility category
 */
export async function getDocumentsByVisibility(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        buildingId: z.string().uuid(),
        visibility: z.enum(['public', 'staff_only']),
      })
      .parse(raw);

    const db = await createClient();

    // Verify user is staff in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can view document categories');
    }

    const ownerVisible = input.visibility === 'public';

    const { data: documents, error } = await db
      .from('documents')
      .select('id, title, type, created_at')
      .eq('building_id', input.buildingId)
      .eq('owner_visible', ownerVisible)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    checkDb(error);

    return {
      ok: true,
      documents: (documents || []).map((d) => ({
        id: d.id,
        title: d.title,
        type: d.type,
        document_type: d.type,
        created_at: d.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
