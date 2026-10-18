import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import type { DeliveryRow } from './delivery';

/**
 * The status of each resident's delivery for one notice. Reads through the caller's session: row-level security limits rows to
 * managers who may adopt bylaws, and column grants exclude any raw address (the column no longer exists).
 */
export async function listNoticeDeliveries(user: SessionUser, noticeId: string): Promise<DeliveryRow[]> {
  const { data, error } = await user.client
    .from('notice_deliveries')
    .select('id,masked_address,status,attempts,last_error,sent_at,queued_at')
    .eq('notice_id', noticeId)
    .order('queued_at', { ascending: true })
    .limit(500);
  checkDb(error);
  return (data ?? []).map((d) => ({
    id: d.id,
    recipient: d.masked_address,
    status: d.status as DeliveryRow['status'],
    attempts: d.attempts,
    lastError: d.last_error,
    sentAt: d.sent_at,
  }));
}

export async function getNoticeForDelivery(user: SessionUser, buildingId: string, noticeId: string) {
  const { data, error } = await user.client
    .from('generated_documents')
    .select('id,title,status')
    .eq('id', noticeId)
    .eq('building_id', buildingId)
    .maybeSingle();
  checkDb(error);
  return data;
}
