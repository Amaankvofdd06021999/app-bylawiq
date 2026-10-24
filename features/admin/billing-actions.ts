'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import { requireLaunchFeature } from '@/lib/launch-scope';

const UpdateSeatsSchema = z.object({
  seats: z.number().int().min(3, 'Minimum 3 seats required'),
});

/**
 * Update seat count for the organization's plan
 */
export async function updateSeatsAction(raw: unknown) {
  try {
    // Payments are off for this release. Refused before the caller is read, so no seat count is written (lib/launch-scope.ts).
    requireLaunchFeature('payments');
    const user = await requireUser();
    const input = UpdateSeatsSchema.parse(raw);

    const db = await createClient();

    // Verify user is org owner or can manage billing
    const { data: orgMember, error: orgError } = await db
      .from('org_members')
      .select('role, org_id')
      .eq('user_id', user.id)
      .single();

    checkDb(orgError);
    if (!orgMember) throw new NotFoundError();

    if (!['org_owner', 'org_admin'].includes(orgMember.role)) {
      throw new ForbiddenError('Only organization owners and admins can update billing');
    }

    // Get current billing account
    const { error: billingError } = await db
      .from('billing_accounts')
      .select('seats')
      .eq('org_id', orgMember.org_id)
      .single();

    checkDb(billingError);

    // Check seat limit is not below current members
    const { data: activeMembers, error: membersError } = await db
      .from('org_members')
      .select('id', { count: 'exact' })
      .eq('org_id', orgMember.org_id)
      .eq('status', 'active');

    checkDb(membersError);

    if (input.seats < (activeMembers?.length || 0)) {
      return {
        ok: false,
        error: `Cannot reduce seats below current member count (${activeMembers?.length || 0})`,
      };
    }

    // Update seats
    const { error: updateError } = await db
      .from('billing_accounts')
      .update({ seats: input.seats })
      .eq('org_id', orgMember.org_id);

    checkDb(updateError);

    return { ok: true, newSeatCount: input.seats };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
