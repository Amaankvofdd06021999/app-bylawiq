'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Resident Management Actions
 * Building managers can view, add, and remove residents
 */

const RemoveResidentSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  userId: z.string().uuid('Invalid user ID'),
});

const InviteResidentSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  email: z.string().email('Invalid email'),
  unitNumber: z.string().min(1, 'Unit number required').max(20),
});

/**
 * Get all residents in a building
 * Only building manager or building staff can view
 */
export async function getResidentsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ buildingId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify user is staff in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can view resident list');
    }

    // Get all residents in building
    const { data: residents, error } = await db
      .from('building_members')
      .select(
        `
      user_id,
      role,
      unit_number,
      created_at,
      profile:profiles(email, display_name)
    `
      )
      .eq('building_id', input.buildingId)
      .eq('role', 'owner_resident')
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    checkDb(error);

    return {
      ok: true,
      residents: (residents || []).map((r: any) => ({
        userId: r.user_id,
        email: r.profile?.email,
        name: r.profile?.display_name || 'Unknown',
        unitNumber: r.unit_number,
        joinedAt: r.created_at,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Remove a resident from building
 * Only building manager can remove
 */
export async function removeResidentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = RemoveResidentSchema.parse(raw);

    const db = await createClient();

    // Verify requestor is building manager
    const { data: requestorMember } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!requestorMember || requestorMember.role !== 'building_manager') {
      throw new ForbiddenError('Only building managers can remove residents');
    }

    // Verify target is a resident in this building
    const { data: targetMember } = await db
      .from('building_members')
      .select('id, role')
      .eq('building_id', input.buildingId)
      .eq('user_id', input.userId)
      .eq('role', 'owner_resident')
      .single();

    if (!targetMember) {
      throw new ForbiddenError('Resident not found in this building');
    }

    // Soft delete the membership
    const { error: deleteError } = await db
      .from('building_members')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', targetMember.id);

    checkDb(deleteError);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Invite a resident to building (send join code via email)
 * Only building manager can invite
 */
export async function inviteResidentAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = InviteResidentSchema.parse(raw);

    const db = await createClient();

    // Verify requestor is building manager
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role !== 'building_manager') {
      throw new ForbiddenError('Only building managers can invite residents');
    }

    // Check if user already exists
    const { data: existingUser } = await db
      .from('profiles')
      .select('id')
      .eq('email', input.email)
      .single();

    let userId: string;

    if (existingUser) {
      // User exists - check if already member
      const { data: existingMember } = await db
        .from('building_members')
        .select('id')
        .eq('building_id', input.buildingId)
        .eq('user_id', existingUser.id)
        .eq('role', 'owner_resident')
        .is('deleted_at', null)
        .single();

      if (existingMember) {
        throw new ForbiddenError('User is already a resident in this building');
      }

      userId = existingUser.id;
    } else {
      // Create invitation (resident signs up later)
      const inviteCode = crypto.randomUUID();
      const { data: building } = await db
        .from('buildings')
        .select('name')
        .eq('id', input.buildingId)
        .single();

      const { data: invitation, error: inviteError } = await db
        .from('invitations')
        .insert({
          building_id: input.buildingId,
          email: input.email,
          role: 'owner_resident',
          invite_code: inviteCode,
          status: 'pending',
          invited_by: user.id,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      checkDb(inviteError);

      // Send invitation email
      try {
        // Email will be triggered via Inngest or email service
        // For now, just log that it should be sent
        console.log(
          `[EMAIL] Resident invitation: ${input.email} to ${building?.name} with code ${inviteCode}`
        );
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }

      return { ok: true, invitationId: invitation.id };
    }

    // Add existing user to building
    const { error: addError } = await db
      .from('building_members')
      .insert({
        user_id: userId,
        building_id: input.buildingId,
        role: 'owner_resident',
        unit_number: input.unitNumber,
      });

    checkDb(addError);

    // Send welcome email to existing resident
    try {
      const { data: building } = await db
        .from('buildings')
        .select('name')
        .eq('id', input.buildingId)
        .single();

      console.log(
        `[EMAIL] Resident added: ${input.email} to ${building?.name}`
      );
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get resident profile (by building manager)
 */
export async function getResidentProfileAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        buildingId: z.string().uuid(),
        residentId: z.string().uuid(),
      })
      .parse(raw);

    const db = await createClient();

    // Verify requestor is staff in this building
    const { data: member } = await db
      .from('building_members')
      .select('role')
      .eq('building_id', input.buildingId)
      .eq('user_id', user.id)
      .single();

    if (!member || member.role === 'owner_resident') {
      throw new ForbiddenError('Only staff can view resident profiles');
    }

    // Get resident profile
    const { data: resident, error } = await db
      .from('building_members')
      .select(
        `
      user_id,
      unit_number,
      created_at,
      profile:profiles(email, display_name)
    `
      )
      .eq('building_id', input.buildingId)
      .eq('user_id', input.residentId)
      .eq('role', 'owner_resident')
      .is('deleted_at', null)
      .single();

    checkDb(error);

    return {
      ok: true,
      resident: {
        userId: resident.user_id,
        email: resident.profile?.email,
        name: resident.profile?.display_name || 'Unknown',
        unitNumber: resident.unit_number,
        joinedAt: resident.created_at,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
