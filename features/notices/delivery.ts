import 'server-only';
import { checkDb } from '@/lib/errors';
import type { NoticeSendResult } from '@/lib/email/notices';

/**
 * Runs one batch of notice deliveries through the database record: queue (one row per resident, idempotent), claim (the attempts
 * due now, counted), send one attempt (by delivery id only; the address is resolved by the sender, never returned here), and
 * record the outcome. A retry is the same call. The database checks the caller's permission at every step.
 */

type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;

export type DeliverySummary = { queued: number; sent: number; failed: number };

export const NOTICE_SENDING_ENABLED = true;

export type DeliveryRow = {
  id: string;
  recipient: string;
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
};

/** Sends one attempt, by delivery id. The sender resolves the address on the server; nothing here sees it. */
export type AttemptSender = (deliveryId: string, subject: string, text: string) => Promise<NoticeSendResult>;

export async function deliverNotice(
  rpc: Rpc,
  noticeId: string,
  subject: string,
  text: string,
  send: AttemptSender,
): Promise<DeliverySummary> {
  const queued = await rpc('queue_notice_delivery', { p_notice: noticeId });
  checkDb(queued.error);

  const batch = await rpc('claim_notice_deliveries', { p_notice: noticeId, p_limit: 50 });
  checkDb(batch.error);

  let sent = 0;
  let failed = 0;
  for (const row of (batch.data ?? []) as { delivery_id: string }[]) {
    const result = await send(row.delivery_id, subject, text);
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

/** Masks an address for display: the first letter and the domain. The database stores this form only. */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');
  if (at <= 0) return '***';
  return address[0] + '***' + address.slice(at);
}
