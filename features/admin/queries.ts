import 'server-only';
import { requireUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import { directoryFor } from '@/lib/directory';
import { createClient } from '@/lib/supabase/server';

export interface TeamMember {
  id: string;
  email: string;
  role: string;
  status: 'active' | 'pending_invite' | 'suspended';
  joinedAt: string | null;
  displayName: string | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  status: TeamMember['status'];
};

async function toTeamMembers(rows: MemberRow[]): Promise<TeamMember[]> {
  const user = await requireUser();
  const directory = await directoryFor(
    user,
    rows.map((r) => r.user_id),
  );
  return rows.map((row) => {
    const person = directory.get(row.user_id);
    return {
      id: row.id,
      email: person?.email ?? 'unknown',
      role: row.role,
      status: row.status,
      joinedAt: null, // org_members has no join date column
      displayName: person?.displayName ?? null,
    };
  });
}

/**
 * Get all team members for the current org (org_members + invitation info)
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const db = await createClient();

  const { data, error } = await db.from('org_members').select('id, user_id, role, status').order('role');

  checkDb(error);
  return toTeamMembers(data ?? []);
}

/**
 * Get pending invitations for the current org
 */
export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const db = await createClient();

  // invitations has no status column: pending means not accepted, not revoked, and not yet expired.
  const { data, error } = await db
    .from('invitations')
    .select('id, email, role, created_at, expires_at')
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  checkDb(error);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Get org member by ID
 */
export async function getTeamMemberById(memberId: string): Promise<TeamMember | null> {
  const db = await createClient();

  const { data, error } = await db
    .from('org_members')
    .select('id, user_id, role, status')
    .eq('id', memberId)
    .maybeSingle();

  if (error || !data) return null;
  const [member] = await toTeamMembers([data]);
  return member ?? null;
}
