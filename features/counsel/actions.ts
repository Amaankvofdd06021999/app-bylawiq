'use server';
import { z } from 'zod';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { checkDb, errorMessage, NotFoundError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/security/rate-limit';

/**
 * External counsel access (PRD §7.4). The database enforces every rule: who may grant, the period, the active grant, expiry,
 * revocation, and what counsel may read or write. These actions check the building permission first and then call the database.
 */

const GrantSchema = z.object({
  buildingId: z.uuid(),
  versionId: z.uuid(),
  email: z.email().trim().max(254),
  days: z.number().int().min(1).max(30),
});

const RevokeSchema = z.object({ buildingId: z.uuid(), grantId: z.uuid() });

const CommentSchema = z.object({
  grantId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, 'Write a comment before sending.')
    .max(2000, 'Keep the comment under 2000 characters.'),
});

export type CounselResult = { ok: true; id?: string } | { ok: false; error: string };

export async function grantCounselAccessAction(raw: unknown): Promise<CounselResult> {
  try {
    const user = await requireUser();
    const input = GrantSchema.parse(raw);
    await requirePermission(user, 'bylaw.adopt', input.buildingId);
    // Each grant attempt tells the manager whether an email has an account (see docs/SECURITY-REVIEW-COUNSEL-ACCESS.md),
    // so attempts are limited per manager. The key is separate from sign-in's.
    await rateLimit('counsel-grant:' + user.id, 'auth');
    const { data, error } = await user.client.rpc('grant_counsel_access_by_email', {
      p_version: input.versionId,
      p_email: input.email,
      p_days: input.days,
    });
    checkDb(error);
    return { ok: true, id: typeof data === 'string' ? data : undefined };
  } catch (e) {
    logger.error({ context: 'counsel_grant', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}

export async function revokeCounselAccessAction(raw: unknown): Promise<CounselResult> {
  try {
    const user = await requireUser();
    const input = RevokeSchema.parse(raw);
    await requirePermission(user, 'bylaw.adopt', input.buildingId);
    const { error } = await user.client.rpc('revoke_counsel_access', { p_grant: input.grantId });
    checkDb(error);
    return { ok: true };
  } catch (e) {
    logger.error({ context: 'counsel_revoke', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addCounselCommentAction(raw: unknown): Promise<CounselResult> {
  try {
    const user = await requireUser();
    const input = CommentSchema.parse(raw);
    // Counsel can see only their own grants (RLS), so a grant that is expired, revoked or someone else's is simply absent.
    const { data: grant, error: grantError } = await user.client
      .from('counsel_grants')
      .select('id,building_id,bylaw_version_id,expires_at,revoked_at')
      .eq('id', input.grantId)
      .maybeSingle();
    checkDb(grantError);
    if (!grant || grant.revoked_at || new Date(grant.expires_at) <= new Date()) {
      throw new NotFoundError('This review is no longer available.');
    }
    const { data, error } = await user.client
      .from('bylaw_comments')
      .insert({
        building_id: grant.building_id,
        version_id: grant.bylaw_version_id,
        user_id: user.id,
        body: input.body,
      })
      .select('id')
      .single();
    checkDb(error);
    return { ok: true, id: data?.id };
  } catch (e) {
    logger.error({ context: 'counsel_comment', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}
