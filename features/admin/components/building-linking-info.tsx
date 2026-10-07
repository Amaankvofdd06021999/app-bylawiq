'use client';
import { Info, ArrowRight, Building2, Key } from 'lucide-react';
import { Card } from '@/components/ui';

export function BuildingLinkingInfo() {
  return (
    <Card className="info-card">
      <div className="info-header">
        <Info size={20} />
        <h3>How to Link Buildings</h3>
      </div>

      <div className="info-steps">
        <div className="step">
          <div className="step-number">1</div>
          <div className="step-content">
            <h4>Building Manager Initiates</h4>
            <p>
              The building's council president or manager goes to their building settings and clicks
              "Link Strata Firm".
            </p>
          </div>
          <Building2 size={20} className="step-icon" />
        </div>

        <ArrowRight size={20} className="step-arrow" />

        <div className="step">
          <div className="step-number">2</div>
          <div className="step-content">
            <h4>Code is Generated</h4>
            <p>
              They generate a unique linking code (format: XXXX-XXXX) that expires in 7 days and is
              valid for one-time use.
            </p>
          </div>
          <Key size={20} className="step-icon" />
        </div>

        <ArrowRight size={20} className="step-arrow" />

        <div className="step">
          <div className="step-number">3</div>
          <div className="step-content">
            <h4>You Accept the Code</h4>
            <p>
              Your organization owner or admin receives the code and enters it here to activate the
              link.
            </p>
          </div>
          <Key size={20} className="step-icon" />
        </div>

        <ArrowRight size={20} className="step-arrow" />

        <div className="step">
          <div className="step-number">4</div>
          <div className="step-content">
            <h4>Link is Active</h4>
            <p>
              Your team gains access to the building's documents, disputes, and can draft notices
              for review.
            </p>
          </div>
          <Building2 size={20} className="step-icon" />
        </div>
      </div>

      <div className="info-footer">
        <p className="text-small">
          <strong>Revoke anytime:</strong> Click the "Revoke Access" button on any linked building
          to immediately remove your firm's access.
        </p>
      </div>

      <style jsx>{`
        .info-card {
          background: var(--color-bg-secondary);
          border-left: 4px solid var(--color-accent);
        }

        .info-header {
          display: flex;
          gap: 0.75rem;
          align-items: center;
          margin-bottom: 1.5rem;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .info-header svg {
          color: var(--color-accent);
          flex-shrink: 0;
        }

        .info-steps {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .step {
          display: flex;
          gap: 1rem;
          align-items: flex-start;
          position: relative;
        }

        .step-number {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 2.5rem;
          height: 2.5rem;
          background: var(--color-accent);
          color: white;
          border-radius: 50%;
          font-weight: 600;
          flex-shrink: 0;
        }

        .step-content {
          flex: 1;
          padding-top: 0.25rem;
        }

        .step-content h4 {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          font-weight: 600;
        }

        .step-content p {
          margin: 0;
          font-size: 0.875rem;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .step-icon {
          color: var(--color-text-secondary);
          flex-shrink: 0;
        }

        .step-arrow {
          align-self: center;
          color: var(--color-border);
          margin: 0 1rem;
        }

        .info-footer {
          padding: 1rem;
          background: var(--color-bg-primary);
          border-radius: var(--radius-md);
        }

        .info-footer p {
          margin: 0;
        }

        @media (max-width: 768px) {
          .step-arrow {
            display: none;
          }

          .step {
            padding-left: 0.5rem;
            border-left: 2px solid var(--color-border);
            margin-left: 0.75rem;
          }
        }
      `}</style>
    </Card>
  );
}
