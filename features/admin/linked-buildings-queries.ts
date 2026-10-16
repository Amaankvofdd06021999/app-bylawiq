import 'server-only';
import { requireUser, type SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import { directoryFor } from '@/lib/directory';
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

type LinkRow = {
  id: string;
  building_id: string;
  status: LinkedBuilding['status'];
  created_at: string | null;
  accepted_at: string | null;
  revoked_at: string | null;
  invited_by: string | null;
};

async function firmOrgIdFor(user: SessionUser): Promise<string | null> {
  const db = await createClient();
  const { data, error } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  checkDb(error);
  return data?.org_id ?? null;
}

async function toLinkedBuildings(user: SessionUser, links: LinkRow[]): Promise<LinkedBuilding[]> {
  const db = await createClient();
  const buildingIds = [...new Set(links.map((l) => l.building_id))];
  const { data: buildings, error: buildingError } = buildingIds.length
    ? await db.from('buildings').select('id, name, municipality').in('id', buildingIds)
    : { data: [], error: null };
  checkDb(buildingError);
  const byId = new Map((buildings ?? []).map((b) => [b.id, b]));
  const inviters = await directoryFor(
    user,
    links.map((l) => l.invited_by).filter((id): id is string => Boolean(id)),
  );

  const result: LinkedBuilding[] = [];
  for (const link of links) {
    const building = byId.get(link.building_id);
    const metrics = await getBuildingMetrics(link.building_id);
    result.push({
      id: link.id,
      buildingId: link.building_id,
      buildingName: building?.name || 'Unknown Building',
      buildingJurisdiction: building?.municipality || 'BC',
      status: link.status,
      linkedAt: link.created_at,
      acceptedAt: link.accepted_at,
      revokedAt: link.revoked_at,
      linkedByEmail: (link.invited_by && inviters.get(link.invited_by)?.email) || 'unknown@example.com',
      documentCount: metrics.documentCount,
      disputeCount: metrics.disputeCount,
      staffCount: metrics.staffCount,
    });
  }
  return result;
}

/**
 * Get all buildings linked to the current organization
 */
export async function getLinkedBuildings(): Promise<LinkedBuilding[]> {
  const user = await requireUser();
  const orgId = await firmOrgIdFor(user);
  if (!orgId) return [];

  const db = await createClient();
  const { data, error } = await db
    .from('firm_building_links')
    .select('id, building_id, status, created_at, accepted_at, revoked_at, invited_by')
    .eq('firm_org_id', orgId)
    .order('created_at', { ascending: false });
  checkDb(error);

  return toLinkedBuildings(user, data ?? []);
}

/**
 * Get metrics for a specific building
 */
export async function getBuildingMetrics(buildingId: string): Promise<BuildingMetrics> {
  const db = await createClient();

  const [docsResult, chunksResult, disputesResult, staffResult, residentsResult] = await Promise.all([
    db.from('documents').select('id', { count: 'exact', head: true }).eq('building_id', buildingId),
    db.from('document_chunks').select('id', { count: 'exact', head: true }).eq('building_id', buildingId),
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
  const user = await requireUser();
  const orgId = await firmOrgIdFor(user);
  if (!orgId) return null;

  const db = await createClient();
  const { data, error } = await db
    .from('firm_building_links')
    .select('id, building_id, status, created_at, accepted_at, revoked_at, invited_by')
    .eq('id', linkId)
    .eq('firm_org_id', orgId)
    .maybeSingle();
  if (error || !data) return null;

  const [linked] = await toLinkedBuildings(user, [data]);
  return linked ?? null;
}
