import 'server-only';
import { requireUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import { directoryFor } from '@/lib/directory';
import { createClient } from '@/lib/supabase/server';

export async function getFeatureFlags() {
  const db = await createClient();
  const { data, error } = await db
    .from('feature_flags')
    .select('id, flag_name, enabled, description, updated_at, updated_by')
    .order('flag_name', { ascending: true });
  checkDb(error);
  return data ?? [];
}

export async function getFeatureFlag(flagName: string) {
  const db = await createClient();
  const { data, error } = await db
    .from('feature_flags')
    .select('id, flag_name, enabled, description')
    .eq('flag_name', flagName)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function getAllOrganizations() {
  const db = await createClient();
  const { data, error } = await db
    .from('organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false });
  checkDb(error);
  const orgs = data ?? [];
  const ids = orgs.map((o) => o.id);
  const [buildingsRes, membersRes] = await Promise.all([
    ids.length
      ? db.from('buildings').select('org_id').in('org_id', ids).is('deleted_at', null)
      : { data: [], error: null },
    ids.length
      ? db.from('org_members').select('org_id').in('org_id', ids).eq('status', 'active')
      : { data: [], error: null },
  ]);
  checkDb(buildingsRes.error);
  checkDb(membersRes.error);
  const buildingCount = new Map<string, number>();
  for (const row of buildingsRes.data ?? [])
    buildingCount.set(row.org_id, (buildingCount.get(row.org_id) ?? 0) + 1);
  const memberCount = new Map<string, number>();
  for (const row of membersRes.data ?? [])
    memberCount.set(row.org_id, (memberCount.get(row.org_id) ?? 0) + 1);
  return orgs.map((o) => ({
    id: o.id,
    name: o.name,
    created_at: o.created_at,
    building_count: buildingCount.get(o.id) ?? 0,
    member_count: memberCount.get(o.id) ?? 0,
  }));
}

export async function getAllBuildings() {
  const db = await createClient();
  const { data, error } = await db
    .from('buildings')
    .select('id, name, address, municipality, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  checkDb(error);
  return data ?? [];
}

export async function getAllUsers() {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db
    .from('profiles')
    .select('id, display_name, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  checkDb(error);
  const people = data ?? [];
  const ids = people.map((p) => p.id);
  const directory = await directoryFor(user, ids);
  const [orgRes, buildingRes] = await Promise.all([
    ids.length
      ? db.from('org_members').select('user_id').in('user_id', ids).eq('status', 'active')
      : { data: [], error: null },
    ids.length
      ? db.from('building_members').select('user_id').in('user_id', ids).eq('status', 'active')
      : { data: [], error: null },
  ]);
  checkDb(orgRes.error);
  checkDb(buildingRes.error);
  const orgCount = new Map<string, number>();
  for (const row of orgRes.data ?? []) orgCount.set(row.user_id, (orgCount.get(row.user_id) ?? 0) + 1);
  const buildingCount = new Map<string, number>();
  for (const row of buildingRes.data ?? [])
    buildingCount.set(row.user_id, (buildingCount.get(row.user_id) ?? 0) + 1);
  return people.map((p) => ({
    id: p.id,
    email: directory.get(p.id)?.email ?? 'unknown',
    display_name: p.display_name,
    created_at: p.created_at,
    org_count: orgCount.get(p.id) ?? 0,
    building_count: buildingCount.get(p.id) ?? 0,
  }));
}

export async function getAdminAuditLog(limit: number = 100) {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db
    .from('platform_admin_audit')
    .select('id, admin_id, action, resource_type, resource_id, details, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  checkDb(error);
  const rows = data ?? [];
  const directory = await directoryFor(
    user,
    rows.map((r) => r.admin_id),
  );
  return rows.map((r) => ({
    ...r,
    admin: {
      display_name: directory.get(r.admin_id)?.displayName ?? null,
      email: directory.get(r.admin_id)?.email ?? null,
    },
  }));
}

export async function getRegionalKBStats() {
  const db = await createClient();
  const { data, error } = await db
    .from('regional_kbs')
    .select('id, region, description, building_count, last_updated')
    .order('region', { ascending: true });
  checkDb(error);
  const kbs = data ?? [];
  const ids = kbs.map((k) => k.id);
  const { data: passages, error: passageError } = ids.length
    ? await db.from('kb_passages').select('kb_id').in('kb_id', ids)
    : { data: [], error: null };
  checkDb(passageError);
  const counts = new Map<string, number>();
  for (const p of passages ?? []) counts.set(p.kb_id, (counts.get(p.kb_id) ?? 0) + 1);
  return kbs.map((k) => ({ ...k, passage_count: counts.get(k.id) ?? 0 }));
}

export async function getPendingDocumentReviews() {
  const user = await requireUser();
  const db = await createClient();
  const { data, error } = await db
    .from('document_reviews')
    .select(
      'id, document_id, building_id, reviewer_id, status, created_at, updated_at, document:documents(title, building_id)',
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  checkDb(error);
  const rows = data ?? [];
  const directory = await directoryFor(
    user,
    rows.map((r) => r.reviewer_id),
  );
  return rows.map((r) => ({
    ...r,
    reviewer: { display_name: directory.get(r.reviewer_id)?.displayName ?? null },
  }));
}
