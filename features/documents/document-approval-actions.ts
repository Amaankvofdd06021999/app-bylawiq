'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { directoryFor } from '@/lib/directory';
import { checkDb, ForbiddenError, NotFoundError, errorMessage } from '@/lib/errors';

/**
 * Document Approval Workflow Actions
 * Operates on generated_documents and uses RPCs (request_firm_review, decide_firm_review).
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
 * Submit document for review by firm owner/manager
 */
export async function submitDocumentForReviewAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SubmitForReviewSchema.parse(raw);

    const { error } = await user.client.rpc('request_firm_review', {
      p_id: input.documentId,
    });
    checkDb(error);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Approve a submitted document
 * Only firm owner/reviewer can approve (separation of duties)
 */
export async function approveDocumentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = ApproveDocumentSchema.parse(raw);

    const { error } = await user.client.rpc('decide_firm_review', {
      p_id: input.documentId,
      p_decision: 'approved',
      p_comment: null,
    });
    checkDb(error);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Request changes on a submitted document
 * Only firm owner/reviewer can request changes
 */
export async function requestDocumentChangesAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = RequestChangesSchema.parse(raw);

    const { error } = await user.client.rpc('decide_firm_review', {
      p_id: input.documentId,
      p_decision: 'changes_requested',
      p_comment: input.comment,
    });
    checkDb(error);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Send approved document to recipient
 * Only authorized staff can send (after approval)
 */
export async function sendApprovedDocumentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = SendDocumentSchema.parse(raw);

    const db = user.client;

    // Get document
    const { data: document, error: docError } = await db
      .from('generated_documents')
      .select('id, building_id, title, status, approved_by')
      .eq('id', input.documentId)
      .eq('building_id', input.buildingId)
      .single();

    checkDb(docError);
    if (!document) {
      throw new NotFoundError('Document not found');
    }

    // Verify document is "approved"
    if (document.status !== 'approved') {
      throw new ForbiddenError('Only approved documents can be sent');
    }

    // Update document to "sent"
    const { error: updateError } = await db
      .from('generated_documents')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', input.documentId);

    checkDb(updateError);

    console.log(
      `[EMAIL] Document approval: ${input.recipientEmail} document=${document.title} ` +
        `document_id=${input.documentId}`,
    );

    return { ok: true, message: `Document sent to ${input.recipientEmail}` };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get pending reviews for firm owner/manager
 */
export async function getPendingReviewsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        limit: z.number().int().min(1).max(100).default(20),
      })
      .parse(raw);

    const db = user.client;

    // Verify firm membership
    const { data: firmMembers, error: memberError } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .in('role', ['org_owner', 'org_admin', 'portfolio_manager'])
      .eq('status', 'active');

    checkDb(memberError);
    if (!firmMembers || firmMembers.length === 0) {
      return { ok: true, reviews: [] };
    }

    const firmOrgIds = firmMembers.map((m) => m.org_id);

    // Get linked building IDs
    const { data: links, error: linksError } = await db
      .from('firm_building_links')
      .select('building_id')
      .in('firm_org_id', firmOrgIds)
      .eq('status', 'active');

    checkDb(linksError);
    if (!links || links.length === 0) {
      return { ok: true, reviews: [] };
    }

    const buildingIds = links.map((l) => l.building_id);

    // Get pending reviews for these linked buildings
    const { data: docs, error } = await db
      .from('generated_documents')
      .select(
        `
        id,
        building_id,
        kind,
        title,
        status,
        created_by,
        created_at,
        building:buildings(name)
      `,
      )
      .in('building_id', buildingIds)
      .eq('status', 'pending_review')
      .eq('review_by', 'firm')
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(input.limit);

    checkDb(error);

    const one = <T>(value: T | T[] | null): T | undefined =>
      Array.isArray(value) ? value[0] : (value ?? undefined);

    const submitterIds = (docs ?? []).map((d) => d.created_by).filter((id): id is string => Boolean(id));
    const directory = await directoryFor(user, submitterIds);

    return {
      ok: true,
      reviews: (docs ?? []).map((d) => {
        const building = one(d.building);
        const submitterEntry = d.created_by ? directory.get(d.created_by) : undefined;
        return {
          id: d.id,
          documentId: d.id,
          buildingId: d.building_id,
          status: 'pending' as const,
          comment: undefined,
          changesRequestedCount: 0,
          createdAt: d.created_at,
          document: { title: d.title },
          building: building ? { name: building.name } : undefined,
          submitter: submitterEntry
            ? { display_name: submitterEntry.displayName || submitterEntry.email }
            : undefined,
        };
      }),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
