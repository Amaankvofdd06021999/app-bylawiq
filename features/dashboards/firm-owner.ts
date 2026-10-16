import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { z } from 'zod';
import { checkDb } from '@/lib/errors';
import type { FirmOwnerData } from './types';

const RosterRow = z.object({
  building_id: z.uuid(),
  building_name: z.string(),
  link_status: z.string(),
  linked_at: z.string().nullable(),
});
const TeamRow = z.object({
  user_id: z.uuid(),
  role: z.string(),
  display_name: z.string(),
  status: z.string(),
});

/**
 * The firm owner's home: the firm the caller owns or administers, its building links and its team. The roster and the
 * team come from functions that check firm membership in the database. Returns null for anyone without that role.
 */
export async function firmOwnerHome(user: SessionUser): Promise<FirmOwnerData | null> {
  const { data: memberships, error: membershipError } = await user.client
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .in('role', ['org_owner', 'org_admin'])
    .eq('status', 'active');
  checkDb(membershipError);
  if (!memberships?.length) return null;

  const { data: firms, error: firmError } = await user.client
    .from('organizations')
    .select('id,name')
    .in(
      'id',
      memberships.map((m) => m.org_id),
    )
    .eq('kind', 'firm')
    .order('name')
    .limit(1);
  checkDb(firmError);
  const firm = firms?.[0];
  if (!firm) return null;

  const { data: rosterData, error: rosterError } = await user.client.rpc('firm_roster', { p_org: firm.id });
  checkDb(rosterError);
  const roster = z.array(RosterRow).parse(rosterData ?? []);
  const { data: teamData, error: teamError } = await user.client.rpc('firm_team', { p_org: firm.id });
  checkDb(teamError);
  const team = z.array(TeamRow).parse(teamData ?? []);
  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  checkDb(profileError);

  const { data: invites, error: inviteError } = await user.client
    .from('firm_invitations')
    .select('id,email,role,expires_at')
    .eq('org_id', firm.id)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });
  checkDb(inviteError);

  return {
    firstName: (profile?.display_name ?? '').split(' ')[0] || 'there',
    firm: { id: firm.id, name: firm.name },
    roster: roster.map((r) => ({
      buildingId: r.building_id,
      name: r.building_name,
      linked: r.link_status === 'active',
      since: r.linked_at,
    })),
    teamInvitations: (invites ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      expiresAt: i.expires_at,
    })),
    staff: team
      .filter((m) => m.status === 'active')
      .map((m) => ({
        userId: m.user_id,
        name: m.display_name,
        role: m.role,
        you: m.user_id === user.id,
      })),
  };
}
