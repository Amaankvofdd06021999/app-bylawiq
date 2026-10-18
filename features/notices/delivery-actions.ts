'use server';
import { z } from 'zod';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { AppError, errorMessage } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { NOTICE_SENDING_ENABLED } from './delivery';

const SendSchema = z.object({ buildingId: z.uuid(), noticeId: z.uuid() });

export type SendResult =
  { ok: true; queued: number; sent: number; failed: number } | { ok: false; error: string };

/**
 * Sends an approved notice to the building's residents, or retries failed deliveries. While NOTICE_SENDING_ENABLED is false
 * (docs/NOTICE-DELIVERY-DECISION.md), it refuses after the permission check and before any database work. The server-only
 * sender that makes it enabled is not written yet.
 */
export async function sendNoticeToResidentsAction(raw: unknown): Promise<SendResult> {
  try {
    const user = await requireUser();
    const input = SendSchema.parse(raw);
    await requirePermission(user, 'bylaw.adopt', input.buildingId);
    if (!NOTICE_SENDING_ENABLED) {
      throw new AppError(
        'sending_disabled',
        'Sending notices is turned off until the sender design is approved.',
        503,
      );
    }
    throw new AppError('sender_not_built', 'The notice sender is not built yet.', 503);
  } catch (e) {
    logger.error({ context: 'notice_delivery', error: e instanceof Error ? e.message : 'unknown' });
    return { ok: false, error: errorMessage(e) };
  }
}
