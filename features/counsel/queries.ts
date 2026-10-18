import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';

/** Grants on one building, with the amendment each one covers. Managers see them through RLS (counsel_grants_read). */
export async function listCounselGrants(user: SessionUser, buildingId: string) {
  const { data: grants, error } = await user.client
    .from('counsel_grants')
    .select('id,bylaw_version_id,granted_at,expires_at,revoked_at')
    .eq('building_id', buildingId)
    .order('granted_at', { ascending: false })
    .limit(50);
  checkDb(error);
  const versionIds = (grants ?? []).map((g) => g.bylaw_version_id);
  const titles = await versionTitles(user, versionIds);
  return (grants ?? []).map((g) => ({
    id: g.id,
    versionId: g.bylaw_version_id,
    title: titles.get(g.bylaw_version_id)?.title ?? 'Amendment',
    grantedAt: g.granted_at,
    expiresAt: g.expires_at,
    revokedAt: g.revoked_at,
  }));
}

/** Amendments in the building that counsel can be given: every version with its section title (RLS: chat.use). */
export async function listAmendments(user: SessionUser, buildingId: string) {
  const { data, error } = await user.client
    .from('bylaw_versions')
    .select('id,node_id,version,status,created_at')
    .eq('building_id', buildingId)
    .order('created_at', { ascending: false })
    .limit(100);
  checkDb(error);
  const titles = await nodeTitles(user, [...new Set((data ?? []).map((v) => v.node_id))]);
  return (data ?? []).map((v) => ({
    id: v.id,
    label:
      `${titles.get(v.node_id)?.section_ref ?? ''} ${titles.get(v.node_id)?.title ?? 'Bylaw'}, version ${v.version} (${v.status.replace(/_/g, ' ')})`.trim(),
  }));
}

/**
 * The review packet for counsel. Counsel sees only the granted grant (RLS). Returns null when the grant is not visible,
 * which covers expired, revoked, another person's, and nonexistent grants alike, so the page cannot tell them apart.
 */
export async function getCounselPacket(user: SessionUser, grantId: string) {
  const { data: grant, error: grantError } = await user.client
    .from('counsel_grants')
    .select('id,building_id,bylaw_version_id,expires_at,revoked_at')
    .eq('id', grantId)
    .maybeSingle();
  checkDb(grantError);
  if (!grant || grant.revoked_at || new Date(grant.expires_at) <= new Date()) return null;

  const { data: version, error: versionError } = await user.client
    .from('bylaw_versions')
    .select('id,node_id,version,status,body,rationale,effective_date,created_at')
    .eq('id', grant.bylaw_version_id)
    .maybeSingle();
  checkDb(versionError);
  if (!version) return null;

  const node = (await nodeTitles(user, [version.node_id])).get(version.node_id);
  const { data: comments, error: commentError } = await user.client
    .from('bylaw_comments')
    .select('id,user_id,body,created_at')
    .eq('version_id', version.id)
    .order('created_at', { ascending: true })
    .limit(200);
  checkDb(commentError);

  return {
    grantId: grant.id,
    expiresAt: grant.expires_at,
    version,
    sectionRef: node?.section_ref ?? '',
    title: node?.title ?? 'Amendment',
    comments: comments ?? [],
    viewerId: user.id,
  };
}

async function versionTitles(user: SessionUser, ids: string[]) {
  const out = new Map<string, { title: string }>();
  if (ids.length === 0) return out;
  const { data, error } = await user.client.from('bylaw_versions').select('id,node_id').in('id', ids);
  checkDb(error);
  const nodes = await nodeTitles(user, [...new Set((data ?? []).map((v) => v.node_id))]);
  for (const v of data ?? []) out.set(v.id, { title: nodes.get(v.node_id)?.title ?? 'Amendment' });
  return out;
}

async function nodeTitles(user: SessionUser, ids: string[]) {
  const out = new Map<string, { title: string; section_ref: string }>();
  if (ids.length === 0) return out;
  const { data, error } = await user.client.from('bylaw_nodes').select('id,title,section_ref').in('id', ids);
  checkDb(error);
  for (const n of data ?? []) out.set(n.id, { title: n.title, section_ref: n.section_ref });
  return out;
}
