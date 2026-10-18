'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { sendNoticeToResidentsAction } from '../delivery-actions';
import type { DeliveryRow } from '../delivery';

const STATUS_WORDS: Record<DeliveryRow['status'], string> = {
  queued: 'Waiting to send',
  sent: 'Sent',
  failed: 'Failed',
};

/**
 * Manager: send an approved notice to residents, see each resident's status, and retry failures. Addresses are masked. Sending
 * is off until the sender design is approved, so the server refuses and the panel shows why.
 */
export function NoticeDeliveryPanel({
  buildingId,
  noticeId,
  noticeStatus,
  deliveries,
}: {
  buildingId: string;
  noticeId: string;
  noticeStatus: string;
  deliveries: DeliveryRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const approved = noticeStatus === 'approved';
  const failed = deliveries.filter((d) => d.status === 'failed').length;
  const sent = deliveries.filter((d) => d.status === 'sent').length;

  async function send() {
    setBusy(true);
    setError('');
    const result = await sendNoticeToResidentsAction({ buildingId, noticeId });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    router.refresh();
  }

  const blockedReason = !approved ? 'Only an approved notice can be sent to residents.' : '';

  return (
    <section aria-labelledby="delivery-heading" className="notice-delivery">
      <h2 id="delivery-heading">Send to residents</h2>
      <p className="muted">
        Each resident receives the notice by email. Addresses are shown masked. {sent} sent, {failed} failed.
      </p>
      <div className="form-footer">
        <Button type="button" disabled={!approved || busy} onClick={() => void send()} busy={busy}>
          Send to residents
        </Button>
        {failed > 0 && (
          <Button type="button" variant="secondary" disabled={!approved || busy} onClick={() => void send()}>
            Retry {failed} failed {failed === 1 ? 'delivery' : 'deliveries'}
          </Button>
        )}
      </div>
      {blockedReason && <p className="muted">{blockedReason}</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      {deliveries.length === 0 ? (
        <p className="muted">No deliveries yet. Residents are added when the notice is sent.</p>
      ) : (
        <table className="delivery-table">
          <caption className="sr-only">Delivery status for each resident</caption>
          <thead>
            <tr>
              <th scope="col">Resident</th>
              <th scope="col">Status</th>
              <th scope="col">Attempts</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((d) => (
              <tr key={d.id}>
                <td>{d.recipient}</td>
                <td>{STATUS_WORDS[d.status]}</td>
                <td>{d.attempts} of 3</td>
                <td>{d.status === 'sent' ? 'Delivered' : (d.lastError ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
