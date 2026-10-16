'use client';
import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { updateSeatsAction } from '../billing-actions';
import type { BillingAccount } from '../billing-queries';

interface SeatsStepperProps {
  billing: BillingAccount;
  utilization: number;
  onUpdate?: () => void;
}

export function SeatsStepper({ billing, utilization, onUpdate }: SeatsStepperProps) {
  const [seats, setSeats] = useState(billing.seats);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const seatCost = billing.seatCost / 100; // Convert cents to dollars
  const baseCost = billing.baseCost / 100;
  const currentCost = (billing.baseCost + billing.seats * billing.seatCost) / 100;
  const newCost = (billing.baseCost + seats * billing.seatCost) / 100;

  const handleDecrease = () => {
    if (seats > Math.max(3, utilization)) {
      setSeats(seats - 1);
      setError('');
    } else {
      setError(`Cannot go below ${Math.max(3, utilization)} seats (current usage)`);
    }
  };

  const handleIncrease = () => {
    setSeats(seats + 1);
    setError('');
  };

  const handleSave = async () => {
    if (seats === billing.seats) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    const result = await updateSeatsAction({ seats });
    setBusy(false);

    if (result.ok) {
      setSuccess(`Seats updated to ${seats}`);
      onUpdate?.();
    } else {
      setError(result.error ?? 'Something went wrong. Please try again.');
      setSeats(billing.seats); // Reset on error
    }
  };

  const costDifference = newCost - currentCost;

  return (
    <Card className="seats-card">
      <h3>Manage Seats</h3>

      <div className="seats-section">
        <div className="seats-info">
          <p className="seats-label">Current seats</p>
          <p className="seats-current">
            {utilization} of {billing.seats} in use
          </p>
          {utilization > 0 && (
            <p className="seats-usage">{Math.round((utilization / billing.seats) * 100)}% utilization</p>
          )}
        </div>

        <div className="seats-stepper">
          <Button
            variant="ghost"
            size="small"
            onClick={handleDecrease}
            disabled={seats <= Math.max(3, utilization) || busy}
            title="Decrease seats"
          >
            <Minus size={16} />
          </Button>

          <input
            type="number"
            value={seats}
            onChange={(e) => {
              const val = Math.max(3, Math.min(999, parseInt(e.target.value) || 3));
              if (val >= Math.max(3, utilization)) {
                setSeats(val);
                setError('');
              }
            }}
            className="seats-input"
            disabled={busy}
            min={Math.max(3, utilization)}
          />

          <Button
            variant="ghost"
            size="small"
            onClick={handleIncrease}
            disabled={busy}
            title="Increase seats"
          >
            <Plus size={16} />
          </Button>
        </div>
      </div>

      <div className="pricing-breakdown">
        <div className="pricing-row">
          <span>Base cost</span>
          <span>${baseCost.toFixed(2)}/mo</span>
        </div>
        {seatCost > 0 && (
          <>
            <div className="pricing-row">
              <span>
                {seats} seats × ${seatCost.toFixed(2)}
              </span>
              <span>${(seats * seatCost).toFixed(2)}/mo</span>
            </div>
            <div className="pricing-divider" />
          </>
        )}
        <div className="pricing-row total">
          <span>New monthly total</span>
          <span>${newCost.toFixed(2)}/mo</span>
        </div>
        {seats !== billing.seats && (
          <div className={`pricing-change ${costDifference > 0 ? 'increase' : 'decrease'}`}>
            {costDifference > 0 ? '+' : ''}${Math.abs(costDifference).toFixed(2)}/mo
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      {success && <p className="form-success">{success}</p>}

      <div className="seats-actions">
        <Button disabled={seats === billing.seats || busy} busy={busy} onClick={handleSave}>
          Update Seats
        </Button>
        {seats !== billing.seats && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => {
              setSeats(billing.seats);
              setError('');
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      <style jsx>{`
        .seats-card {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .seats-card h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .seats-section {
          display: flex;
          gap: 2rem;
          align-items: center;
        }

        .seats-info {
          flex: 1;
        }

        .seats-label {
          margin: 0 0 0.25rem 0;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .seats-current {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
        }

        .seats-usage {
          margin: 0.25rem 0 0 0;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .seats-stepper {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: 0.5rem;
        }

        .seats-input {
          width: 4rem;
          text-align: center;
          border: none;
          background: transparent;
          font-size: 1.5rem;
          font-weight: 600;
          padding: 0;
        }

        .seats-input:focus {
          outline: none;
        }

        .pricing-breakdown {
          padding: 1rem;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          font-size: 0.95rem;
        }

        .pricing-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .pricing-row.total {
          font-weight: 600;
          font-size: 1rem;
        }

        .pricing-divider {
          height: 1px;
          background: var(--color-border);
          margin: 0.5rem 0;
        }

        .pricing-change {
          margin-top: 0.5rem;
          padding: 0.5rem;
          border-radius: var(--radius-md);
          font-weight: 600;
          text-align: center;
        }

        .pricing-change.increase {
          background: #fee;
          color: #c33;
        }

        .pricing-change.decrease {
          background: #efe;
          color: #3c3;
        }

        .seats-actions {
          display: flex;
          gap: 1rem;
        }
      `}</style>
    </Card>
  );
}
