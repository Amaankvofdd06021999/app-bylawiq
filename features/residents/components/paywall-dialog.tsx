'use client';
import { useState } from 'react';
import { X, CreditCard, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { purchaseCreditsAction } from '../resident-chat-actions';

interface PaywallDialogProps {
  buildingId: string;
  buildingName: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaywallDialog({
  buildingId,
  buildingName,
  onClose,
  onSuccess,
}: PaywallDialogProps) {
  const [selectedPackage, setSelectedPackage] = useState<number>(100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const creditPackages = [
    { credits: 50, label: '$10' },
    { credits: 100, label: '$20' },
    { credits: 250, label: '$45' },
    { credits: 500, label: '$85' },
  ];

  const handlePurchase = async () => {
    setBusy(true);
    const result = await purchaseCreditsAction({
      buildingId,
      creditAmount: selectedPackage,
    });
    setBusy(false);

    if (result.ok) {
      setSuccess(`✅ Credits added!`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="paywall-overlay" onClick={onClose}>
      <div className="paywall-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <X size={20} />
        </button>
        <AlertCircle size={32} />
        <h2>Get credits to continue</h2>
        <p>You have used all free questions. Purchase credits to keep asking.</p>
        
        <div className="packages-grid">
          {creditPackages.map((pkg) => (
            <button
              key={pkg.credits}
              className={`package-card ${selectedPackage === pkg.credits ? 'selected' : ''}`}
              onClick={() => setSelectedPackage(pkg.credits)}
            >
              <div className="package-credits">{pkg.credits}</div>
              <div className="package-price">{pkg.label}</div>
            </button>
          ))}
        </div>

        <div className="demo-label">Demo Mode — No real charge</div>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <div className="dialog-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={handlePurchase}
            disabled={busy}
            busy={busy}
          >
            Add {selectedPackage} Credits
          </Button>
        </div>

        <style jsx>{`
          .paywall-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .paywall-dialog {
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            position: relative;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
          }

          .close-button {
            position: absolute;
            top: 1rem;
            right: 1rem;
            background: none;
            border: none;
            cursor: pointer;
          }

          .packages-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin: 1.5rem 0;
          }

          .package-card {
            padding: 1rem;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
          }

          .package-card.selected {
            border-color: #3b82f6;
            background: #f0f9ff;
          }

          .package-credits {
            font-size: 1.5rem;
            font-weight: 700;
            color: #3b82f6;
          }

          .demo-label {
            padding: 0.75rem;
            background: #fef3c7;
            border-radius: 8px;
            font-size: 0.875rem;
            color: #92400e;
            margin: 1rem 0;
          }

          .dialog-actions {
            display: flex;
            gap: 1rem;
            justify-content: flex-end;
          }
        `}</style>
      </div>
    </div>
  );
}
