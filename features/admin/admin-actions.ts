'use server';

import { createHash, randomBytes } from 'node:crypto';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

// Each action calls a database function that checks the caller itself (rotate_invitation, revoke_invitation).

/**
 * Resend invitation: issues a new link (the old one stops working). No email is sent; the admin shares the link.
 */
export async function resendInvitationAction({
  invitationId,
}: {
  invitationId: string;
}): Promise<{ ok: boolean; error?: string; link?: string }> {
  try {
    await requireUser();
    const db = await createClient();
    const token = randomBytes(32).toString('hex');
    const { error } = await db.rpc('rotate_invitation', {
      p_id: invitationId,
      p_hash: createHash('sha256').update(token).digest('hex'),
      p_expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) return { ok: false, error: 'This invitation can no longer be resent.' };
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return { ok: true, link: base + '/invite/' + token };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke invitation (soft delete)
 */
export async function revokeInvitationAction({
  invitationId,
}: {
  invitationId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireUser();
    const db = await createClient();
    const { error } = await db.rpc('revoke_invitation', { p_id: invitationId });
    if (error) return { ok: false, error: 'Failed to revoke invitation' };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
