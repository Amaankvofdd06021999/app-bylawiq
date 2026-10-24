'use server';
import { createHash, randomBytes } from 'node:crypto';
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

    const targetRole = input.role === 'portfolio_assistant' ? 'portfolio_manager' : input.role;
    if (targetRole !== 'org_admin' && targetRole !== 'portfolio_manager') {
      return { ok: false, error: 'Only org_admin and portfolio_manager roles can be invited to a firm' };
    }

    const token = randomBytes(24).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Create firm invitation via canonical database procedure
    const { data: invitationId, error: inviteError } = await db.rpc('create_firm_invitation', {
      p_org: orgMember.org_id,
      p_email: input.email.trim().toLowerCase(),
      p_role: targetRole,
      p_token_hash: tokenHash,
      p_expires: expiresAt,
    });

    checkDb(inviteError);

    // Send invitation email
    const { data: org } = await db.from('organizations').select('name').eq('id', orgMember.org_id).single();

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/workspace?firmInvite=${token}`;
    console.log(
      `[EMAIL] Team invite: ${input.email} to ${org?.name} org=${orgMember.org_id} link=${inviteLink}`,
    );

    return { ok: true, invitationId: String(invitationId) };
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
