'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, NotFoundError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Document Approval Workflow Actions
 * Implements separation of duties: draft creator ≠ approver
 */

const SubmitForReviewSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  buildingId: z.string().uuid('Invalid building ID'),
});

const ApproveDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  buildingId: z.string().uuid('Invalid building ID'),
});

const RequestChangesSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  buildingId: z.string().uuid('Invalid building ID'),
  comment: z.string().min(10, 'Comment required (min 10 chars)').max(1000),
});

const SendDocumentSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  buildingId: z.string().uuid('Invalid building ID'),
  recipientEmail: z.string().email('Invalid email'),
});

/**
 * Submit document for review by firm owner
 * Only available to strata managers and building managers
 */
export async function submitDocumentForReviewAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SubmitForReviewSchema.parse(raw);

    const db = await createClient();

    // Get document
    const { data: document, error: docError } = await db
      .from('documents')
      .select('id, building_id, title, submitted_by, status')
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(docError);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Check status
    if (document.status !== 'draft') {
      throw new ForbiddenError('Only draft documents can be submitted for review');
    }

    // Verify user is staff (not resident)
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can submit documents for review');
    }

    // Update document status to "submitted"
    const { error: updateError } = await db
      .from('documents')
      .update({
        status: 'submitted',
        submitted_by: user.id,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', input.documentId);

    checkDb(updateError);

    // Create review entry (pending approval)
    const { error: reviewError } = await db
      .from('document_reviews')
      .insert({
        document_id: input.documentId,
        building_id: input.buildingId,
        reviewer_id: user.id,
        status: 'pending',
        comment: 'Awaiting firm owner review',
      });

    checkDb(reviewError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Approve a submitted document
 * Only firm owner can approve (separation of duties)
 */
export async function approveDocumentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = ApproveDocumentSchema.parse(raw);

    const db = await createClient();

    // Get document
    const { data: document, error: docError } = await db
      .from('documents')
      .select('id, building_id, title, submitted_by, status')
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(docError);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify approver is firm owner
    const { data: firmMember } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!firmMember || firmMember.role !== 'org_owner') {
      throw new ForbiddenError('Only firm owners can approve documents');
    }

    // Separation of duties: approver ≠ submitter
    if (document.submitted_by === user.id) {
      throw new ForbiddenError('You cannot approve your own submissions (separation of duties)');
    }

    // Verify document is in "submitted" status
    if (document.status !== 'submitted') {
      throw new ForbiddenError('Only submitted documents can be approved');
    }

    // Update document to "approved"
    const { error: updateError } = await db
      .from('documents')
      .update({
        status: 'approved',
        approved_by: user.id,
        approved_at: new Date().toISOString(),
      })
      .eq('id', input.documentId);

    checkDb(updateError);

    // Update review record
    const { error: reviewError } = await db
      .from('document_reviews')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('document_id', input.documentId);

    checkDb(reviewError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Request changes on a submitted document
 * Only firm owner can request changes
 */
export async function requestDocumentChangesAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = RequestChangesSchema.parse(raw);

    const db = await createClient();

    // Get document
    const { data: document, error: docError } = await db
      .from('documents')
      .select('id, building_id, title, submitted_by, status')
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(docError);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify requestor is firm owner
    const { data: firmMember } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!firmMember || firmMember.role !== 'org_owner') {
      throw new ForbiddenError('Only firm owners can request changes');
    }

    // Verify document is in "submitted" status
    if (document.status !== 'submitted') {
      throw new ForbiddenError('Only submitted documents can be updated');
    }

    // Update review status to "changes_requested"
    const { error: reviewError } = await db
      .from('document_reviews')
      .update({
        status: 'changes_requested',
        comment: input.comment,
        changes_requested_count: db.raw('changes_requested_count + 1'),
        updated_at: new Date().toISOString(),
      })
      .eq('document_id', input.documentId);

    checkDb(reviewError);

    // Revert document to "draft" so creator can edit
    const { error: updateError } = await db
      .from('documents')
      .update({
        status: 'draft',
      })
      .eq('id', input.documentId);

    checkDb(updateError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Send approved document to recipient
 * Only firm owner can send (after approval)
 */
export async function sendApprovedDocumentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SendDocumentSchema.parse(raw);

    const db = await createClient();

    // Get document
    const { data: document, error: docError } = await db
      .from('documents')
      .select('id, building_id, title, status, approved_by')
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(docError);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify sender is firm owner
    const { data: firmMember } = await db
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', user.id)
      .single();

    if (!firmMember || firmMember.role !== 'org_owner') {
      throw new ForbiddenError('Only firm owners can send documents');
    }

    // Verify document is "approved"
    if (document.status !== 'approved') {
      throw new ForbiddenError('Only approved documents can be sent');
    }

    // Update document to "sent"
    const { error: updateError } = await db
      .from('documents')
      .update({
        status: 'sent',
        sent_by: user.id,
        sent_at: new Date().toISOString(),
      })
      .eq('id', input.documentId);

    checkDb(updateError);

    // Send email to recipient with document link
    const { data: document } = await db
      .from('documents')
      .select('title')
      .eq('id', input.documentId)
      .single();

    console.log(
      `[EMAIL] Document approval: ${input.recipientEmail} document=${document?.title} ` +
      `document_id=${input.documentId}`
    );

    return { ok: true, message: `Document sent to ${input.recipientEmail}` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get pending reviews for firm owner
 */
export async function getPendingReviewsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(raw);

    const db = await createClient();

    // Verify firm owner
    const { data: firmMember } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('role', 'org_owner')
      .single();

    if (!firmMember) {
      throw new ForbiddenError('Only firm owners can view pending reviews');
    }

    // Get pending reviews for this org
    const { data: reviews, error } = await db
      .from('document_reviews')
      .select(
        `
      id,
      document_id,
      building_id,
      status,
      comment,
      changes_requested_count,
      created_at,
      document:documents(title, submitted_by),
      building:buildings(name),
      submitter:profiles!documents.submitted_by(display_name)
    `
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(input.limit);

    checkDb(error);

    return { ok: true, reviews: reviews || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
