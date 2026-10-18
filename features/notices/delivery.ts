import 'server-only';
import { checkDb } from '@/lib/errors';
import type { NoticeSender } from '@/lib/email/notices';

/**
 * Sends an approved notice to every active resident, through the database record. Each step is a database call that checks
 * the caller's permission: queue (one row per resident, idempotent), claim (the attempts to make now), and record (the outcome).
 * A retry is the same call: nothing is queued twice, and failed deliveries with attempts left are claimed again.
 */

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

export type DeliverySummary = { queued: number; sent: number; failed: number };

export type DeliveryRow = {
  id: string;
  recipient: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
};

/** Masks an address for the status list: the first letter and the domain. */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) return '***';
  return address[0] + '***' + address.slice(at);
}

export async function deliverNotice(
  rpc: Rpc,
  noticeId: string,
  subject: string,
  text: string,
  sender: NoticeSender,
): Promise<DeliverySummary> {
  const queued = await rpc('queue_notice_delivery', { p_notice: noticeId });
  checkDb(queued.error);

  const batch = await rpc('claim_notice_deliveries', { p_notice: noticeId, p_limit: 50 });
  checkDb(batch.error);

  let sent = 0;
  let failed = 0;
  for (const row of (batch.data ?? []) as { delivery_id: string; email_address: string }[]) {
    const result = await sender(row.email_address, subject, text);
    const recorded = await rpc('record_notice_delivery_result', {
      p_delivery: row.delivery_id,
      p_ok: result.ok,
      p_error: result.ok ? null : result.error,
    });
    checkDb(recorded.error);
    if (result.ok) sent += 1;
    else failed += 1;
  }
  return { queued: Number(queued.data ?? 0), sent, failed };
}
