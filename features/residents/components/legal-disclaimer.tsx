'use client';
import { AlertCircle } from 'lucide-react';

interface LegalDisclaimerProps {
  buildingName: string;
}

export function LegalDisclaimer({ buildingName }: LegalDisclaimerProps) {
  return (
    <div className="legal-disclaimer">
      <div className="disclaimer-icon">
        <AlertCircle size={20} />
      </div>

      <div className="disclaimer-content">
        <h4>Legal Information Disclaimer</h4>
        <p>
          This AI assistant provides information based on <strong>{buildingName}'s bylaws</strong> and
          applicable <strong>British Columbia strata property law</strong>. This is{' '}
          <strong>not legal advice</strong>. Always consult a qualified lawyer before taking action
          on legal matters.
        </p>
        <ul>
          <li>Responses are grounded in provided building documents</li>
          <li>Information is current as of document upload date</li>
          <li>Complex situations may require professional legal guidance</li>
          <li>You are responsible for verifying accuracy in your situation</li>
        </ul>
      </div>

      <style jsx>{`
        .legal-disclaimer {
          display: flex;
          gap: 1rem;
          padding: 1rem;
          background: #fef5f5;
          border: 1px solid #fecaca;
          border-left: 4px solid #dc2626;
          border-radius: 8px;
          margin-bottom: 1.5rem;
        }

        .disclaimer-icon {
          flex-shrink: 0;
          color: #dc2626;
          padding-top: 0.25rem;
        }

        .disclaimer-content {
          flex: 1;
        }

        .disclaimer-content h4 {
          margin: 0 0 0.75rem 0;
          font-size: 0.95rem;
          font-weight: 700;
          color: #7f1d1d;
        }

        .disclaimer-content p {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          line-height: 1.5;
          color: #5f2120;
        }

        .disclaimer-content p:last-of-type {
          margin-bottom: 0.5rem;
        }

        .disclaimer-content ul {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.85rem;
          color: #5f2120;
        }

        .disclaimer-content li {
          margin: 0.25rem 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
