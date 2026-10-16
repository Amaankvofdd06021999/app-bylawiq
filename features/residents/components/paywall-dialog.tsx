'use client';
import { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { createCreditCheckoutAction } from '../checkout-actions';

type PaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buildingId: string;
  needed: number;
  credits: number;
  pack: { credits: number; price: number };
};

export function PaywallDialog({ open, onOpenChange, buildingId, needed, credits, pack }: PaywallDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buy() {
    setBusy(true);
    setError(null);
    const result = await createCreditCheckoutAction({ buildingId });
    if (result.ok) {
      window.location.assign(result.url);
      return;
    }
    setBusy(false);
    setError(result.error);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add credits to continue"
      description={`This needs ${needed} credits. You have ${credits}.`}
    >
      <p>
        {pack.credits} credits for ${pack.price}. You will pay on Stripe&rsquo;s secure page. Credits are
        added once the payment is confirmed.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
          Not now
        </Button>
        <Button onClick={buy} busy={busy}>
          Buy {pack.credits} credits
        </Button>
      </div>
    </Modal>
  );
}
