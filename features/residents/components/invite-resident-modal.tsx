'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';
import { X } from 'lucide-react';
import { inviteResidentAction } from '../resident-management-actions';

// What the manager sees about the email. The link is always shown (decision D10).
const EMAIL_NOTE: Record<string, string> = {
  sent: 'We emailed the invitation. The link below also works.',
  failed: 'The email could not be sent. Share the link below directly.',
  not_configured: 'Email is not set up in this environment. Share the link below directly.',
  skipped_staging:
    'In this test environment, email goes only to test recipients. Share the link below directly.',
};

interface InviteResidentModalProps {
  buildingId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteResidentModal({ buildingId, onClose, onSuccess }: InviteResidentModalProps) {
  const [email, setEmail] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [sent, setSent] = useState<{ link: string; emailStatus: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInvite = async () => {
    if (!email.trim() || !unitNumber.trim()) {
      setError('Enter the email address and the unit number');
      return;
    }

    try {
      setLoading(true);
      const result = await inviteResidentAction({
        buildingId,
        email,
        unitNumber,
      });

      if (result.ok && result.link) {
        setSent({ link: result.link, emailStatus: result.emailStatus ?? 'not_configured' });
      } else if (!result.ok) {
        setError(result.error || 'Failed to invite resident');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inviting resident');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Invite Resident</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="unit">Unit number</label>
            <input
              id="unit"
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="12A"
              maxLength={20}
              disabled={loading}
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="resident@example.com"
              disabled={loading}
              className="input"
            />
          </div>

          {sent ? (
            <div className="link-output" role="status">
              <p>{EMAIL_NOTE[sent.emailStatus] ?? EMAIL_NOTE.not_configured}</p>
              <p>
                <a href={sent.link}>{sent.link}</a>
              </p>
            </div>
          ) : (
            <p className="info">
              The resident accepts the invitation by signing in with this email address. The link expires in
              14 days. Your building manager confirms the unit before the resident’s home shows it as
              verified.
            </p>
          )}
        </div>

        <div className="modal-footer">
          {sent ? (
            <Button
              onClick={() => {
                onSuccess();
              }}
            >
              Done
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button
                onClick={handleInvite}
                disabled={loading || !email.trim() || !unitNumber.trim()}
                busy={loading}
              >
                {loading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
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

        .modal {
          background: white;
          border-radius: 8px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.25rem;
          color: #1f2937;
        }

        .close-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          color: #666;
          transition: color 0.2s;
        }

        .close-btn:hover {
          color: #1f2937;
        }

        .modal-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .form-group label {
          font-weight: 600;
          color: #1f2937;
          font-size: 0.95rem;
        }

        .input {
          padding: 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-family: inherit;
          font-size: 0.95rem;
        }

        .input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .input:disabled {
          background: #f9fafb;
          cursor: not-allowed;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .info {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }
      `}</style>
    </div>
  );
}
