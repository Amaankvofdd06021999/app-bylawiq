import 'server-only';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { checkDb, NotFoundError } from '@/lib/errors';
import type { FirmKnowledgeResult, FirmKnowledgeStats } from './types';

/**
 * Search firm's knowledge base using hybrid search (BM25 + embeddings)
 * Accessible to firm staff and linked building managers
 */
export async function searchFirmKnowledge(
  firmId: string,
  query: string,
  buildingId?: string,
): Promise<FirmKnowledgeResult[]> {
  const user = await requireUser();

  // Verify user has access to firm knowledge
  const { data: orgMember, error: orgError } = await user.client
    .from('org_members')
    .select('role')
    .eq('org_id', firmId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(orgError);
  if (!orgMember) {
    return []; // User is not firm staff
  }

  // If building is specified, verify access
  if (buildingId) {
    const { data: member } = await user.client
      .from('building_members')
      .select('role')
      .eq('building_id', buildingId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!member) {
      return []; // User doesn't have access to building
    }
  }

  // Search firm knowledge
  const { data: results, error: searchError } = await user.client.rpc('search_firm_knowledge', {
    p_firm_id: firmId,
    p_query: query,
    p_limit: 20,
    p_building_id: buildingId || null,
  });

  checkDb(searchError);

  // Increment view stat for first result
  if ((results || []).length > 0 && buildingId) {
    const firstDoc = results[0];
    await user.client.rpc('increment_firm_knowledge_stat', {
      p_document_id: firstDoc.document_id,
      p_building_id: buildingId,
      p_stat_type: 'view',
    });
  }

  return results || [];
}

/**
 * Get firm's published documents
 */
export async function firmDocuments(firmId: string): Promise<FirmKnowledgeResult['document_id'][]> {
  const user = await requireUser();

  // Verify user is firm staff
  const { data: orgMember, error: orgError } = await user.client
    .from('org_members')
    .select('role')
    .eq('org_id', firmId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(orgError);
  if (!orgMember) {
    return [];
  }

  // Fetch published documents
  const { data: documents, error: docsError } = await user.client
    .from('firm_documents')
    .select('id, title, doc_kind, created_at, view_count, used_count')
    .eq('firm_id', firmId)
    .not('published_at', 'is', null)
    .order('created_at', { ascending: false });

  checkDb(docsError);

  return documents || [];
}

/**
 * Get knowledge statistics for a building
 */
export async function firmKnowledgeStats(
  firmId: string,
  buildingId: string,
): Promise<FirmKnowledgeStats[]> {
  const user = await requireUser();

  // Verify building access
  await requirePermission(user, 'member.read', buildingId);

  // Fetch stats for documents used in this building
  const { data: stats, error: statsError } = await user.client
    .from('firm_knowledge_stats')
    .select(
      `
      document_id,
      view_count,
      used_count,
      last_viewed_at,
      last_used_at,
      firm_documents!inner(title, doc_kind)
    `,
    )
    .eq('building_id', buildingId)
    .eq('firm_documents.firm_id', firmId)
    .order('last_viewed_at', { ascending: false });

  checkDb(statsError);

  return (stats || []).map((s: any) => ({
    documentId: s.document_id,
    title: s.firm_documents?.title || 'Unknown',
    kind: s.firm_documents?.doc_kind || 'guide',
    views: s.view_count || 0,
    uses: s.used_count || 0,
    lastViewedAt: s.last_viewed_at ? new Date(s.last_viewed_at) : null,
    lastUsedAt: s.last_used_at ? new Date(s.last_used_at) : null,
  }));
}
