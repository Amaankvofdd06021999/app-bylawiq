/**
 * Portfolio Queries
 * For strata managers viewing all assigned buildings at once
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Get portfolio dashboard for strata manager
 */
export async function getPortfolioDashboard(userId: string) {
  const db = await createClient();

  // Get all assigned buildings for this user
  const { data: assignments, error: assignmentError } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (assignmentError) throw assignmentError;

  const buildingIds = assignments?.map((a: any) => a.building_id) || [];

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

  // Get building details with metrics
  const { data: buildings, error: buildingError } = await db
    .from('buildings')
    .select(
      `
      id,
      name,
      address,
      city,
      region,
      (select count(*) from building_members where building_id = buildings.id and role = 'owner_resident' and deleted_at is null)::int as resident_count,
      (select count(*) from documents where building_id = buildings.id)::int as document_count,
      (select count(*) from disputes where building_id = buildings.id and deleted_at is null)::int as dispute_count
    `
    )
    .in('id', buildingIds)
    .order('name', { ascending: true });

  if (buildingError) throw buildingError;

  const buildings_data = buildings || [];

  // Calculate totals
  const totalStats = buildings_data.reduce(
    (acc: any, b: any) => ({
      documents: acc.documents + (b.document_count || 0),
      disputes: acc.disputes + (b.dispute_count || 0),
      residents: acc.residents + (b.resident_count || 0),
    }),
    { documents: 0, disputes: 0, residents: 0 }
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

  const { data, error } = await db
    .from('org_assignments')
    .select(
      `
      building_id,
      building:buildings(id, name, address, city, region)
    `
    )
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) throw error;

  return (data || []).map((a: any) => a.building);
}

/**
 * Search documents across all assigned buildings (portfolio search)
 */
export async function searchPortfolioDocuments(userId: string, query: string) {
  const db = await createClient();

  // Get assigned buildings
  const { data: assignments } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const buildingIds = assignments?.map((a: any) => a.building_id) || [];

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
      document_type,
      created_at,
      building:buildings(name, city)
    `
    )
    .in('building_id', buildingIds)
    .ilike('title', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  return data || [];
}

/**
 * Get portfolio documents awaiting review
 */
export async function getPortfolioPendingReviews(userId: string) {
  const db = await createClient();

  // Get assigned buildings
  const { data: assignments } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const buildingIds = assignments?.map((a: any) => a.building_id) || [];

  if (buildingIds.length === 0) {
    return [];
  }

  // Get pending reviews in assigned buildings
  const { data, error } = await db
    .from('document_reviews')
    .select(
      `
      id,
      document_id,
      building_id,
      status,
      created_at,
      document:documents(title, submitted_by),
      building:buildings(name),
      submitter:profiles!documents.submitted_by(display_name)
    `
    )
    .in('building_id', buildingIds)
    .in('status', ['pending', 'changes_requested'])
    .order('created_at', { ascending: true });

  if (error) throw error;

  return data || [];
}

/**
 * Get portfolio analytics
 */
export async function getPortfolioAnalytics(userId: string) {
  const db = await createClient();

  // Get assigned buildings
  const { data: assignments } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', userId)
    .is('deleted_at', null);

  const buildingIds = assignments?.map((a: any) => a.building_id) || [];

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

  // Get document stats
  const { data: docs } = await db
    .from('documents')
    .select('status')
    .in('building_id', buildingIds);

  const docCounts = {
    created: docs?.filter((d: any) => d.status === 'draft').length || 0,
    approved: docs?.filter((d: any) => d.status === 'approved').length || 0,
    sent: docs?.filter((d: any) => d.status === 'sent').length || 0,
  };

  // Get dispute stats
  const { data: disputes } = await db
    .from('disputes')
    .select('status')
    .in('building_id', buildingIds)
    .is('deleted_at', null);

  const disputeCounts = {
    created: disputes?.filter((d: any) => d.status === 'open').length || 0,
    closed: disputes?.filter((d: any) => d.status === 'closed').length || 0,
  };

  // Get resident stats
  const { data: residents } = await db
    .from('building_members')
    .select('id')
    .in('building_id', buildingIds)
    .eq('role', 'owner_resident')
    .is('deleted_at', null);

  return {
    documentsCreated: docCounts.created,
    documentsApproved: docCounts.approved,
    documentsSent: docCounts.sent,
    disputesCreated: disputeCounts.created,
    disputesClosed: disputeCounts.closed,
    residentsActive: residents?.length || 0,
  };
}
