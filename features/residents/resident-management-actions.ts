'use server';

import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { deliverInvitation } from '@/features/workspace/invitation-delivery';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { directoryFor } from '@/lib/directory';
import { checkDb, ForbiddenError, errorMessage, NotFoundError } from '@/lib/errors';
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
  unitNumber: z.string().trim().min(1, 'Unit number required').max(20),
});

const VerifyUnitSchema = z.object({
  buildingId: z.string().uuid('Invalid building ID'),
  userId: z.string().uuid('Invalid user ID'),
  unitNumber: z.string().trim().min(1).max(20),
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

    // Permission-gated (decision D1): any staff role with member.read (council members see the list, read-only).
    await requirePermission(user, 'member.read', input.buildingId);

    // Get all residents in building
    const { data: residents, error } = await db
      .from('building_members')
      .select(
        `
      user_id,
      role,
      unit_number,
      unit_verified_at,
      joined_at
    `,
      )
      .eq('building_id', input.buildingId)
      .eq('role', 'owner_resident')
      .eq('status', 'active')
      .order('joined_at', { ascending: true });

    checkDb(error);
    const directory = await directoryFor(
      user,
      (residents ?? []).map((r) => r.user_id),
    );

    return {
      ok: true,
      residents: (residents ?? []).map((r) => ({
        userId: r.user_id,
        email: directory.get(r.user_id)?.email ?? null,
        name: directory.get(r.user_id)?.displayName || 'Unknown',
        unitNumber: r.unit_number,
        unitVerified: r.unit_verified_at !== null,
        joinedAt: r.joined_at,
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

    // Permission-gated (decision D1): building managers and council presidents hold member.remove for their building.
    await requirePermission(user, 'member.remove', input.buildingId);

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

    // Suspend the membership
    const { error: deleteError } = await db
      .from('building_members')
      .update({ status: 'suspended' })
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

    // Permission-gated (decision D1): building managers and council presidents hold member.invite for their building.
    await requirePermission(user, 'member.invite', input.buildingId);

    // The invitation rules and the already-a-member check are in the database (create_resident_invitation). The unit is
    // recorded on the invitation and stays unverified until a building manager confirms it (verify_resident_unit).
    const token = randomBytes(32).toString('hex');
    const { data: invitationId, error: inviteError } = await db.rpc('create_resident_invitation', {
      p_building: input.buildingId,
      p_email: input.email,
      p_unit: input.unitNumber,
      p_hash: createHash('sha256').update(token).digest('hex'),
      p_expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
    checkDb(inviteError);
    const link = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/invite/' + token;

    const emailStatus = await deliverInvitation(db, {
      invitationId: String(invitationId),
      buildingId: input.buildingId,
      email: input.email,
      role: 'owner_resident',
      link,
    });

    return { ok: true, invitationId: String(invitationId), link, emailStatus };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Confirm a resident's unit against the building's records. The database checks the caller (a building manager or council
 * president) and that the unit matches what the resident entered; a resident cannot verify themselves.
 */
export async function verifyResidentUnitAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = VerifyUnitSchema.parse(raw);
    await requirePermission(user, 'member.invite', input.buildingId);
    const db = await createClient();
    checkDb(
      (
        await db.rpc('verify_resident_unit', {
          p_building: input.buildingId,
          p_user: input.userId,
          p_unit: input.unitNumber,
        })
      ).error,
    );
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

/**
 * Get resident profile/**
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
      joined_at
    `,
      )
      .eq('building_id', input.buildingId)
      .eq('user_id', input.residentId)
      .eq('role', 'owner_resident')
      .eq('status', 'active')
      .single();

    checkDb(error);
    if (!resident) throw new NotFoundError();
    const directory = await directoryFor(user, [resident.user_id]);

    return {
      ok: true,
      resident: {
        userId: resident.user_id,
        email: directory.get(resident.user_id)?.email ?? null,
        name: directory.get(resident.user_id)?.displayName || 'Unknown',
        unitNumber: resident.unit_number,
        joinedAt: resident.joined_at,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
