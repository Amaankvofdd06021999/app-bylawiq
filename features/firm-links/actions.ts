'use server';
import { revalidatePath } from 'next/cache';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { checkDb, errorMessage, AppError } from '@/lib/errors';
import { rateLimit } from '@/lib/security/rate-limit';
import { generateCode, normalizeCode, hashCode } from '@/lib/link-codes';
import { buildingInput, acceptInput } from './schema';
import { z } from 'zod';
export async function createFirmCodeAction(
  raw: unknown,
): Promise<{ ok: true; code: string; url: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const input = buildingInput.parse(raw);
    await requirePermission(user, 'building.link_firm', input.buildingId);
    const code = generateCode();
    checkDb(
      (await user.client.rpc('create_firm_code', { p_building: input.buildingId, p_hash: hashCode(code) }))
        .error,
    );
    revalidatePath('/b/' + input.buildingId + '/settings');
    return {
      ok: true,
      code,
      url: (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000') + '/workspace?code=' + code,
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
export async function revokeFirmLinkAction(
  raw: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const input = buildingInput.parse(raw);
    await requirePermission(user, 'building.link_firm', input.buildingId);
    checkDb((await user.client.rpc('revoke_firm_link', { p_building: input.buildingId })).error);
    revalidatePath('/b', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
// No building is known until the code is redeemed; accept_firm_code checks the caller's firm role itself.
export async function acceptFirmCodeAction(
  raw: unknown,
): Promise<{ ok: true; buildingId: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const input = acceptInput.parse(raw);
    await rateLimit(user.id, 'auth');
    const code = normalizeCode(input.code);
    if (!code) throw new AppError('invalid_code', 'That code isn’t valid. Check it and try again.');
    const { data, error } = await user.client.rpc('accept_firm_code', {
      p_hash: hashCode(code),
      p_firm_org: input.firmOrgId,
    });
    checkDb(error);
    revalidatePath('/workspace', 'layout');
    return { ok: true, buildingId: z.uuid().parse(data) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
