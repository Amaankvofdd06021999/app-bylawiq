/**
 * Document Approval Workflow Queries
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Get pending reviews for a firm owner
 */
export async function getPendingReviewsForFirmOwner(userId: string) {
  const db = await createClient();

  // Get org this user owns
  const { data: org } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('role', 'org_owner')
    .single();

  if (!org) return [];

  // Get buildings linked to this org
  const { data: links } = await db
    .from('building_links')
    .select('building_id')
    .eq('org_id', org.org_id);

  const buildingIds = links?.map((l: any) => l.building_id) || [];

  if (buildingIds.length === 0) return [];

  // Get pending reviews in linked buildings
  const { data: reviews } = await db
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
    .in('building_id', buildingIds)
    .in('status', ['pending', 'changes_requested'])
    .order('created_at', { ascending: true });

  return reviews || [];
}

/**
 * Get review history for a document
 */
export async function getDocumentReviewHistory(documentId: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('document_reviews')
    .select(
      `
      id,
      status,
      comment,
      changes_requested_count,
      created_at,
      updated_at,
      reviewer:profiles(display_name, email)
    `
    )
    .eq('document_id', documentId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get document status with all approval details
 */
export async function getDocumentApprovalStatus(documentId: string) {
  const db = await createClient();

  const { data: document, error } = await db
    .from('documents')
    .select(
      `
      id,
      title,
      status,
      submitted_by,
      submitted_at,
      approved_by,
      approved_at,
      sent_by,
      sent_at,
      submitter:profiles!documents.submitted_by(display_name),
      approver:profiles!documents.approved_by(display_name),
      sender:profiles!documents.sent_by(display_name)
    `
    )
    .eq('id', documentId)
    .single();

  if (error) return null;

  return document;
}

/**
 * Get documents pending approval in a building
 */
export async function getPendingDocumentsInBuilding(buildingId: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('documents')
    .select(
      `
      id,
      title,
      status,
      submitted_at,
      submitted_by:profiles!documents.submitted_by(display_name)
    `
    )
    .eq('building_id', buildingId)
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get document sent history (for audit trail)
 */
export async function getDocumentSentHistory(buildingId: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('documents')
    .select(
      `
      id,
      title,
      sent_at,
      sent_by:profiles!documents.sent_by(display_name)
    `
    )
    .eq('building_id', buildingId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

/**
 * Get approval timeline for a document (CRT evidence)
 */
export async function getApprovalTimeline(documentId: string) {
  const db = await createClient();

  const { data: document } = await db
    .from('documents')
    .select(
      `
      id,
      title,
      created_at,
      submitted_at,
      approved_at,
      sent_at,
      status
    `
    )
    .eq('id', documentId)
    .single();

  if (!document) return null;

  const timeline = [
    { event: 'Created', timestamp: document.created_at, status: 'draft' },
  ];

  if (document.submitted_at) {
    timeline.push({ event: 'Submitted for Review', timestamp: document.submitted_at, status: 'submitted' });
  }

  if (document.approved_at) {
    timeline.push({ event: 'Approved', timestamp: document.approved_at, status: 'approved' });
  }

  if (document.sent_at) {
    timeline.push({ event: 'Sent', timestamp: document.sent_at, status: 'sent' });
  }

  return {
    documentId: document.id,
    title: document.title,
    currentStatus: document.status,
    timeline,
  };
}
