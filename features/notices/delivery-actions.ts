'use server';
import { z } from 'zod';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { checkDb, errorMessage, NotFoundError } from '@/lib/errors';
import { sendNoticeEmail } from '@/lib/email/notices';
import { logger } from '@/lib/logger';
import { deliverNotice } from './delivery';

const SendSchema = z.object({ buildingId: z.uuid(), noticeId: z.uuid() });

export type SendResult =
  { ok: true; queued: number; sent: number; failed: number } | { ok: false; error: string };

/**
 * Sends an approved notice to the building's residents, or retries the failed deliveries. Permission is checked first, and
 * the database checks it again for every step.
 */
export async function sendNoticeToResidentsAction(raw: unknown): Promise<SendResult> {
  try {
    const user = await requireUser();
    const input = SendSchema.parse(raw);
    await requirePermission(user, 'bylaw.adopt', input.buildingId);

    const { data: notice, error } = await user.client
      .from('generated_documents')
      .select('id,title,body_md')
      .eq('id', input.noticeId)
      .eq('building_id', input.buildingId)
      .maybeSingle();
    checkDb(error);
    if (!notice) throw new NotFoundError('This notice is not available.');

    const summary = await deliverNotice(
      (fn, args) => user.client.rpc(fn, args),
      notice.id,
      notice.title,
      notice.body_md,
      sendNoticeEmail,
    );
    return { ok: true, ...summary };
  } catch (e) {
    logger.error({ context: 'notice_delivery', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}
