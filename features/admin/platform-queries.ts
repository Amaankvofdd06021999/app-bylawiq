/**
 * Platform Admin queries
 * Read-only access to platform-wide data
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Get all feature flags
 */
export async function getFeatureFlags() {
  const db = await createClient();

  const { data, error } = await db
    .from('feature_flags')
    .select('id, flag_name, enabled, description, updated_at, updated_by')
    .order('flag_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get specific feature flag
 */
export async function getFeatureFlag(flagName: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('feature_flags')
    .select('id, flag_name, enabled, description')
    .eq('flag_name', flagName)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get all organizations (platform admin view)
 */
export async function getAllOrganizations() {
  const db = await createClient();

  const { data, error } = await db
    .from('organizations')
    .select(
      `
      id,
      name,
      org_type,
      created_at,
      (select count(*) from building_links where org_id = organizations.id)::int as building_count,
      (select count(*) from org_members where org_id = organizations.id and deleted_at is null)::int as member_count
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get organization details
 */
export async function getOrganizationDetails(orgId: string) {
  const db = await createClient();

  const { data, error } = await db
    .from('organizations')
    .select(
      `
      id,
      name,
      org_type,
      created_at,
      (select count(*) from building_links where org_id = id)::int as building_count,
      (select count(*) from org_members where org_id = id and deleted_at is null)::int as member_count
    `
    )
    .eq('id', orgId)
    .single();

  if (error) return null;
  return data;
}

/**
 * Get all buildings (platform admin view)
 */
export async function getAllBuildings() {
  const db = await createClient();

  const { data, error } = await db
    .from('buildings')
    .select(
      `
      id,
      name,
      address,
      city,
      region,
      created_at,
      (select count(*) from building_members where building_id = buildings.id and deleted_at is null)::int as member_count,
      (select count(*) from documents where building_id = buildings.id)::int as document_count
    `
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Get all users (platform admin view)
 */
export async function getAllUsers() {
  const db = await createClient();

  const { data, error } = await db
    .from('auth.users')
    .select(
      `
      id,
      email,
      created_at,
      last_sign_in_at,
      (select count(*) from org_members where user_id = id and deleted_at is null)::int as org_count,
      (select count(*) from building_members where user_id = id and deleted_at is null)::int as building_count
    `
    )
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

/**
 * Get platform admin audit log
 */
export async function getAdminAuditLog(limit: number = 100) {
  const db = await createClient();

  const { data, error } = await db
    .from('platform_admin_audit')
    .select(
      `
      id,
      admin_id,
      action,
      resource_type,
      resource_id,
      details,
      created_at,
      admin:profiles(display_name, email)
    `
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get regional KB statistics
 */
export async function getRegionalKBStats() {
  const db = await createClient();

  const { data, error } = await db
    .from('regional_kbs')
    .select(
      `
      id,
      region,
      description,
      building_count,
      last_updated,
      (select count(*) from kb_passages where kb_id = regional_kbs.id)::int as passage_count
    `
    )
    .order('region', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Get all documents needing approval (admin view)
 */
export async function getPendingDocumentReviews() {
  const db = await createClient();

  const { data, error } = await db
    .from('document_reviews')
    .select(
      `
      id,
      document_id,
      building_id,
      reviewer_id,
      status,
      created_at,
      updated_at,
      document:documents(title, building_id),
      reviewer:profiles(display_name)
    `
    )
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}
