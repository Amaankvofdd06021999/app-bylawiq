import { createClient } from '@/lib/supabase/server';

export interface LinkedBuilding {
  id: string;
  buildingId: string;
  buildingName: string;
  buildingJurisdiction: string;
  status: 'pending' | 'active' | 'revoked';
  linkedAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  linkedByEmail: string;
  documentCount: number;
  disputeCount: number;
  staffCount: number;
}

export interface BuildingMetrics {
  buildingId: string;
  documentCount: number;
  documentChunkCount: number;
  disputeCount: number;
  staffCount: number;
  residentCount: number;
}

/**
 * Get all buildings linked to the current organization
 */
export async function getLinkedBuildings(): Promise<LinkedBuilding[]> {
  const db = await createClient();

  // First get org_id for current user
  const { data: orgMember, error: orgError } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', (await db.auth.getUser()).data.user?.id)
    .single();

  if (orgError || !orgMember) return [];

  const { data, error } = await db
    .from('firm_building_links')
    .select(`
      id,
      building_id,
      status,
      created_at,
      accepted_at,
      revoked_at,
      inviter:invited_by(email),
      building:buildings(name, jurisdiction)
    `)
    .eq('firm_org_id', orgMember.org_id)
    .order('created_at', { ascending: false });

  if (error) throw error;

  const linkedBuildings: LinkedBuilding[] = [];

  for (const link of data || []) {
    const metrics = await getBuildingMetrics(link.building_id);

    linkedBuildings.push({
      id: link.id,
      buildingId: link.building_id,
      buildingName: link.building.name || 'Unknown Building',
      buildingJurisdiction: link.building.jurisdiction || 'BC',
      status: link.status,
      linkedAt: link.created_at,
      acceptedAt: link.accepted_at,
      revokedAt: link.revoked_at,
      linkedByEmail: link.inviter?.email || 'unknown@example.com',
      documentCount: metrics.documentCount,
      disputeCount: metrics.disputeCount,
      staffCount: metrics.staffCount,
    });
  }

  return linkedBuildings;
}

/**
 * Get metrics for a specific building
 */
export async function getBuildingMetrics(buildingId: string): Promise<BuildingMetrics> {
  const db = await createClient();

  const [docsResult, chunksResult, disputesResult, staffResult, residentsResult] =
    await Promise.all([
      db.from('documents').select('id', { count: 'exact', head: true }).eq('building_id', buildingId),
      db
        .from('document_chunks')
        .select('id', { count: 'exact', head: true })
        .in('document_id', [
          ...((
            await db.from('documents').select('id').eq('building_id', buildingId)
          ).data || []),
        ]),
      db.from('disputes').select('id', { count: 'exact', head: true }).eq('building_id', buildingId),
      db
        .from('building_members')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .neq('role', 'owner_resident'),
      db
        .from('building_members')
        .select('id', { count: 'exact', head: true })
        .eq('building_id', buildingId)
        .eq('role', 'owner_resident'),
    ]);

  return {
    buildingId,
    documentCount: docsResult.count || 0,
    documentChunkCount: chunksResult.count || 0,
    disputeCount: disputesResult.count || 0,
    staffCount: staffResult.count || 0,
    residentCount: residentsResult.count || 0,
  };
}

/**
 * Get a single linked building by ID
 */
export async function getLinkedBuildingById(linkId: string): Promise<LinkedBuilding | null> {
  const db = await createClient();

  const { data: orgMember } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', (await db.auth.getUser()).data.user?.id)
    .single();

  if (!orgMember) return null;

  const { data, error } = await db
    .from('firm_building_links')
    .select(`
      id,
      building_id,
      status,
      created_at,
      accepted_at,
      revoked_at,
      firm_org_id,
      inviter:invited_by(email),
      building:buildings(name, jurisdiction)
    `)
    .eq('id', linkId)
    .eq('firm_org_id', orgMember.org_id)
    .single();

  if (error || !data) return null;

  const metrics = await getBuildingMetrics(data.building_id);

  return {
    id: data.id,
    buildingId: data.building_id,
    buildingName: data.building.name || 'Unknown Building',
    buildingJurisdiction: data.building.jurisdiction || 'BC',
    status: data.status,
    linkedAt: data.created_at,
    acceptedAt: data.accepted_at,
    revokedAt: data.revoked_at,
    linkedByEmail: data.inviter?.email || 'unknown@example.com',
    documentCount: metrics.documentCount,
    disputeCount: metrics.disputeCount,
    staffCount: metrics.staffCount,
  };
}
