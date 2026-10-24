/**
 * Portfolio Queries
 * For strata managers viewing all assigned buildings at once
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Helper to get all building IDs managed by this user (either through building_members or firm_building_links)
 */
async function getUserManagedBuildingIds(
  db: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  // 1. Direct building staff memberships
  const { data: staffMembers } = await db
    .from('building_members')
    .select('building_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .neq('role', 'owner_resident');

  // 2. Firm memberships through active firm_building_links
  const { data: firmMembers } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .in('role', ['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant']);

  let firmBuildingIds: string[] = [];
  if (firmMembers && firmMembers.length > 0) {
    const firmOrgIds = firmMembers.map((m: { org_id: string }) => m.org_id);
    const { data: links } = await db
      .from('firm_building_links')
      .select('building_id')
      .in('firm_org_id', firmOrgIds)
      .eq('status', 'active');
    firmBuildingIds = links?.map((l: { building_id: string }) => l.building_id) || [];
  }

  const directBuildingIds = staffMembers?.map((m: { building_id: string }) => m.building_id) || [];
  return Array.from(new Set([...directBuildingIds, ...firmBuildingIds]));
}

/**
 * Get portfolio dashboard for strata manager
 */
export async function getPortfolioDashboard(userId: string) {
  const db = await createClient();
  const buildingIds = await getUserManagedBuildingIds(db, userId);

  if (buildingIds.length === 0) {
    return {
      totalBuildings: 0,
      buildings: [],
      stats: {
        totalDocuments: 0,
        totalDisputes: 0,
        totalResidents: 0,
      },
    };
  }

  const { data: buildingRows, error: buildingError } = await db
    .from('buildings')
    .select('id, name, address, municipality')
    .in('id', buildingIds)
    .order('name', { ascending: true });
  if (buildingError) throw buildingError;

  const [residentRes, documentRes, disputeRes] = await Promise.all([
    db
      .from('building_members')
      .select('building_id')
      .in('building_id', buildingIds)
      .eq('role', 'owner_resident')
      .eq('status', 'active'),
    db.from('documents').select('building_id').in('building_id', buildingIds),
    db.from('disputes').select('building_id').in('building_id', buildingIds),
  ]);
  if (residentRes.error) throw residentRes.error;
  if (documentRes.error) throw documentRes.error;
  if (disputeRes.error) throw disputeRes.error;

  const countBy = (rows: { building_id: string }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) counts.set(row.building_id, (counts.get(row.building_id) ?? 0) + 1);
    return counts;
  };
  const residents = countBy(residentRes.data);
  const documents = countBy(documentRes.data);
  const disputes = countBy(disputeRes.data);

  const buildings_data = (buildingRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    city: b.municipality,
    region: null,
    resident_count: residents.get(b.id) ?? 0,
    document_count: documents.get(b.id) ?? 0,
    dispute_count: disputes.get(b.id) ?? 0,
  }));

  // Calculate totals
  const totalStats = buildings_data.reduce(
    (acc, b) => ({
      documents: acc.documents + (b.document_count || 0),
      disputes: acc.disputes + (b.dispute_count || 0),
      residents: acc.residents + (b.resident_count || 0),
    }),
    { documents: 0, disputes: 0, residents: 0 },
  );

  return {
    totalBuildings: buildings_data.length,
    buildings: buildings_data,
    stats: {
      totalDocuments: totalStats.documents,
      totalDisputes: totalStats.disputes,
      totalResidents: totalStats.residents,
    },
  };
}

/**
 * Get all assigned buildings (simple list)
 */
export async function getAssignedBuildings(userId: string) {
  const db = await createClient();
  const buildingIds = await getUserManagedBuildingIds(db, userId);

  if (buildingIds.length === 0) {
    return [];
  }

  const { data, error } = await db
    .from('buildings')
    .select('id, name, address, municipality')
    .in('id', buildingIds)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Search documents across all assigned buildings (portfolio search)
 */
export async function searchPortfolioDocuments(userId: string, query: string) {
  const db = await createClient();
  const buildingIds = await getUserManagedBuildingIds(db, userId);

  if (buildingIds.length === 0) {
    return [];
  }

  // Search across all assigned buildings
  const { data, error } = await db
    .from('documents')
    .select(
      `
      id,
      title,
      building_id,
      type,
      created_at,
      building:buildings(name, municipality)
    `,
    )
    .in('building_id', buildingIds)
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  type DocRow = {
    id: string;
    title: string;
    building_id: string;
    type: string;
    created_at: string;
    building: { name: string; municipality: string } | null;
  };

  return ((data as unknown as DocRow[]) || []).map((d) => ({
    id: d.id,
    title: d.title,
    building_id: d.building_id,
    document_type: d.type,
    created_at: d.created_at,
    building: d.building ? { name: d.building.name, city: d.building.municipality } : undefined,
  }));
}

/**
 * Get portfolio documents awaiting review
 */
export async function getPortfolioPendingReviews(userId: string) {
  const db = await createClient();
  const buildingIds = await getUserManagedBuildingIds(db, userId);

  if (buildingIds.length === 0) {
    return [];
  }

  // Get pending reviews in assigned buildings from generated_documents
  const { data, error } = await db
    .from('generated_documents')
    .select(
      `
      id,
      title,
      building_id,
      status,
      created_at,
      building:buildings(name)
    `,
    )
    .in('building_id', buildingIds)
    .in('status', ['pending_review', 'changes_requested'])
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get portfolio analytics
 */
export async function getPortfolioAnalytics(userId: string) {
  const db = await createClient();
  const buildingIds = await getUserManagedBuildingIds(db, userId);

  if (buildingIds.length === 0) {
    return {
      documentsCreated: 0,
      documentsApproved: 0,
      documentsSent: 0,
      disputesCreated: 0,
      disputesClosed: 0,
      residentsActive: 0,
    };
  }

  // Notices (generated_documents) carry the draft, approved and sent states.
  const { data: notices, error: noticesError } = await db
    .from('generated_documents')
    .select('status')
    .in('building_id', buildingIds)
    .is('deleted_at', null);
  if (noticesError) throw noticesError;

  const docCounts = {
    created: (notices ?? []).filter((d) => d.status === 'draft').length,
    approved: (notices ?? []).filter((d) => d.status === 'approved').length,
    sent: (notices ?? []).filter((d) => d.status === 'sent').length,
  };

  // Disputes have a stage, not a status. Resolved and withdrawn are the closed stages.
  const closedStages = ['resolved', 'withdrawn'];
  const { data: disputes, error: disputesError } = await db
    .from('disputes')
    .select('stage')
    .in('building_id', buildingIds)
    .is('deleted_at', null);
  if (disputesError) throw disputesError;

  const disputeCounts = {
    created: (disputes ?? []).filter((d) => !closedStages.includes(d.stage)).length,
    closed: (disputes ?? []).filter((d) => closedStages.includes(d.stage)).length,
  };

  // Get resident stats
  const { data: residents } = await db
    .from('building_members')
    .select('id')
    .in('building_id', buildingIds)
    .eq('role', 'owner_resident')
    .eq('status', 'active');

  return {
    documentsCreated: docCounts.created,
    documentsApproved: docCounts.approved,
    documentsSent: docCounts.sent,
    disputesCreated: disputeCounts.created,
    disputesClosed: disputeCounts.closed,
    residentsActive: residents?.length || 0,
  };
}
