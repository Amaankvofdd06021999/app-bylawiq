'use server';

import { createHash, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, errorMessage } from '@/lib/errors';
import { rateLimit } from '@/lib/security/rate-limit';

/**
 * Firm team: invite by email, revoke, remove, accept. Every call runs through the caller's client; the database
 * functions decide who may act. The invitation token is generated here and only its hash is stored.
 */

const INVITE_DAYS = 14;

const InviteSchema = z.object({
  firmOrgId: z.uuid(),
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(['org_admin', 'portfolio_manager']),
});
const RevokeSchema = z.object({ invitationId: z.uuid() });
const RemoveSchema = z.object({ firmOrgId: z.uuid(), userId: z.uuid() });
const AcceptSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,80}$/) });

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export type InviteResult = { ok: true; url: string; email: string } | { ok: false; error: string };
export type Result = { ok: true } | { ok: false; error: string };

export async function inviteFirmMemberAction(raw: unknown): Promise<InviteResult> {
  try {
    const user = await requireUser();
    const input = InviteSchema.parse(raw);
    await rateLimit(user.id, 'auth');
    const token = randomBytes(24).toString('base64url');
    const expires = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    checkDb(
      (
        await user.client.rpc('create_firm_invitation', {
          p_org: input.firmOrgId,
          p_email: input.email,
          p_role: input.role,
          p_token_hash: hashToken(token),
          p_expires: expires,
        })
      ).error,
    );
    revalidatePath('/workspace');
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return { ok: true, url: `${base}/workspace?firmInvite=${token}`, email: input.email };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function revokeFirmInvitationAction(raw: unknown): Promise<Result> {
  try {
    const user = await requireUser();
    const input = RevokeSchema.parse(raw);
    checkDb((await user.client.rpc('revoke_firm_invitation', { p_id: input.invitationId })).error);
    revalidatePath('/workspace');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeFirmMemberAction(raw: unknown): Promise<Result> {
  try {
    const user = await requireUser();
    const input = RemoveSchema.parse(raw);
    checkDb(
      (await user.client.rpc('remove_firm_member', { p_org: input.firmOrgId, p_user: input.userId })).error,
    );
    revalidatePath('/workspace');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function acceptFirmInvitationAction(raw: unknown): Promise<Result> {
  try {
    const user = await requireUser();
    const input = AcceptSchema.parse(raw);
    await rateLimit(user.id, 'auth');
    checkDb(
      (await user.client.rpc('accept_firm_invitation', { p_token_hash: hashToken(input.token) })).error,
    );
    revalidatePath('/workspace', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
