import { createClient } from '@/lib/supabase/server';
import type { Row } from '@/lib/schema';

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

/**
 * Get all team members for the current org (org_members + invitation info)
 */
export async function getTeamMembers(): Promise<TeamMember[]> {
  const db = await createClient();

  const { data, error } = await db
    .from('org_members')
    .select(`
      id,
      user_id,
      role,
      status,
      created_at,
      user:auth.users(email, raw_user_meta_data)
    `)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    email: row.user?.email || 'unknown',
    role: row.role,
    status: row.status,
    joinedAt: row.created_at,
    displayName: row.user?.raw_user_meta_data?.display_name || null,
  }));
}

/**
 * Get pending invitations for the current org
 */
export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const db = await createClient();

  const { data, error } = await db
    .from('invitations')
    .select('id, email, role, created_at, expires_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
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
    .select(`
      id,
      user_id,
      role,
      status,
      created_at,
      user:auth.users(email, raw_user_meta_data)
    `)
    .eq('id', memberId)
    .single();

  if (error) return null;

  return {
    id: data.id,
    email: data.user?.email || 'unknown',
    role: data.role,
    status: data.status,
    joinedAt: data.created_at,
    displayName: data.user?.raw_user_meta_data?.display_name || null,
  };
}
