'use client';
import { Check, ArrowRight } from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';
import type { BillingAccount } from '../billing-queries';
import { PLAN_DETAILS } from '../plan-details';

interface PlanCardProps {
  billing: BillingAccount;
  onUpgrade?: () => void;
}

export function PlanCard({ billing, onUpgrade }: PlanCardProps) {
  const plan = PLAN_DETAILS[billing.plan];
  const monthlyTotal = billing.monthlyTotal / 100; // Convert cents to dollars

  return (
    <Card className="plan-card">
      <div className="plan-header">
        <div>
          <div className="plan-name">
            <h3>{plan.name}</h3>
            {billing.launchDiscount && <Badge tone="success">Launch Price</Badge>}
          </div>
          <p className="plan-description">{plan.description}</p>
        </div>
      </div>

      <div className="plan-pricing">
        <div className="price">
          <span className="amount">${monthlyTotal.toFixed(2)}</span>
          <span className="period">/month</span>
        </div>
        {billing.launchDiscount && (
          <p className="discount-note">
            Regular price: ${((billing.baseCost * 2) / 100).toFixed(2)}/mo (50% off)
          </p>
        )}
      </div>

      <div className="plan-features">
        <h4>Features included</h4>
        <ul>
          {plan.features.map((feature, i) => (
            <li key={i}>
              <Check size={16} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="plan-actions">
        {billing.plan === 'pilot' && (
          <Button onClick={onUpgrade}>
            Upgrade Plan
            <ArrowRight size={16} />
          </Button>
        )}
        {billing.plan !== 'pilot' && billing.plan !== 'enterprise' && (
          <Button variant="ghost">
            {billing.plan === 'building' ? 'Upgrade to Building Pro' : 'Contact Sales'}
          </Button>
        )}
        {billing.plan === 'enterprise' && (
          <p className="text-muted">Custom plan - contact support for changes</p>
        )}
      </div>

      <style jsx>{`
        .plan-card {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          border: 2px solid var(--color-border);
        }

        .plan-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .plan-name {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
        }

        .plan-name h3 {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .plan-description {
          margin: 0;
          font-size: 0.95rem;
          color: var(--color-text-secondary);
        }

        .plan-pricing {
          padding: 1.5rem;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
        }

        .price {
          display: flex;
          align-items: baseline;
          gap: 0.25rem;
          margin-bottom: 0.5rem;
        }

        .amount {
          font-size: 2rem;
          font-weight: 700;
        }

        .period {
          font-size: 0.875rem;
          color: var(--color-text-secondary);
        }

        .discount-note {
          margin: 0;
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        }

        .plan-features {
          flex: 1;
        }

        .plan-features h4 {
          margin: 0 0 1rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .plan-features ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .plan-features li {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.95rem;
        }

        .plan-features svg {
          color: var(--color-success);
          flex-shrink: 0;
        }

        .plan-actions {
          display: flex;
          gap: 1rem;
        }

        .plan-actions p {
          margin: 0;
          color: var(--color-text-secondary);
        }
      `}</style>
    </Card>
  );
}
