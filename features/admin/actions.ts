'use server';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { InviteTeamMemberSchema, RemoveTeamMemberSchema } from './schema';

/**
 * Invite a team member to the organization
 */
export async function inviteTeamMemberAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = InviteTeamMemberSchema.parse(raw);

    const db = await createClient();

    // Verify user is org_owner or org_admin
    const { data: orgMember, error: orgError } = await db
      .from('org_members')
      .select('role, org_id')
      .eq('user_id', user.id)
      .single();

    checkDb(orgError);
    if (!orgMember) throw new NotFoundError();

    if (!['org_owner', 'org_admin'].includes(orgMember.role)) {
      throw new ForbiddenError('Only org owners and admins can invite team members');
    }

    // Check if user is already a member
    const { data: existingMember } = await db
      .from('org_members')
      .select('id')
      .eq('org_id', orgMember.org_id)
      .match({ email: input.email })
      .single();

    if (existingMember) {
      return { ok: false, error: 'User is already a member of this organization' };
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await db
      .from('invitations')
      .insert({
        org_id: orgMember.org_id,
        email: input.email,
        role: input.role,
        invited_by: user.id,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .select('id')
      .single();

    checkDb(inviteError);
    if (!invitation) throw new NotFoundError();

    // Send invitation email
    const { data: org } = await db.from('organizations').select('name').eq('id', orgMember.org_id).single();

    console.log(
      `[EMAIL] Team invite: ${input.email} to ${org?.name} org=${orgMember.org_id} code=${invitation.id}`,
    );

    return { ok: true, invitationId: invitation.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Remove a team member from the organization
 */
export async function removeTeamMemberAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = RemoveTeamMemberSchema.parse(raw);

    const db = await createClient();

    // Verify user is org_owner or org_admin
    const { data: orgMember, error: orgError } = await db
      .from('org_members')
      .select('role, org_id')
      .eq('user_id', user.id)
      .single();

    checkDb(orgError);
    if (!orgMember) throw new NotFoundError();

    if (!['org_owner', 'org_admin'].includes(orgMember.role)) {
      throw new ForbiddenError('Only org owners and admins can remove team members');
    }

    // Get member to remove
    const { data: targetMember, error: getMemberError } = await db
      .from('org_members')
      .select('org_id, user_id')
      .eq('id', input.memberId)
      .single();

    checkDb(getMemberError);
    if (!orgMember) throw new NotFoundError();
    if (!targetMember) throw new NotFoundError();

    // Verify member is in same org
    if (targetMember.org_id !== orgMember.org_id) {
      throw new ForbiddenError('Cannot remove members from other organizations');
    }

    // Prevent removing self
    if (targetMember.user_id === user.id) {
      return { ok: false, error: 'Cannot remove yourself from the organization' };
    }

    // Suspend the member (soft delete)
    const { error: suspendError } = await db
      .from('org_members')
      .update({ status: 'suspended' })
      .eq('id', input.memberId);

    checkDb(suspendError);
    if (!orgMember) throw new NotFoundError();

    // Notify user of removal
    const { data: removedUser } = await db
      .from('profiles')
      .select('display_name')
      .eq('id', targetMember.user_id)
      .maybeSingle();

    const { data: org } = await db
      .from('organizations')
      .select('name')
      .eq('id', orgMember.org_id)
      .maybeSingle();

    console.log(
      `[EMAIL] Team member removed: ${removedUser?.display_name || targetMember.user_id} from ${org?.name}`,
    );

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
