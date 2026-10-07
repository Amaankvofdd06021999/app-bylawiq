'use client';

import { useState } from 'react';
import { Mail, Trash2, Clock } from 'lucide-react';
import type { PendingInvitation } from '../queries';
import { resendInvitationAction, revokeInvitationAction } from '../admin-actions';

interface PendingInvitationsTableProps {
  invitations: PendingInvitation[];
}

export function PendingInvitationsTable({ invitations }: PendingInvitationsTableProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState(invitations);

  const handleResend = async (invitationId: string, email: string) => {
    try {
      setIsLoading(invitationId);
      setError(null);

      const result = await resendInvitationAction({ invitationId, email });

      if (!result.ok) {
        setError(result.error || 'Failed to resend invitation');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error sending invitation');
    } finally {
      setIsLoading(null);
    }
  };

  const handleRevoke = async (invitationId: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;

    try {
      setIsLoading(invitationId);
      setError(null);

      const result = await revokeInvitationAction({ invitationId });

      if (result.ok) {
        setItems(items.filter((i) => i.id !== invitationId));
      } else {
        setError(result.error || 'Failed to revoke invitation');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error revoking invitation');
    } finally {
      setIsLoading(null);
    }
  };

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <p>No pending invitations.</p>
      </div>
    );
  }

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  return (
    <div className="table-container">
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      <table className="invitations-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Sent</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((invitation) => {
            const expired = isExpired(invitation.expiresAt);
            const sentDate = new Date(invitation.createdAt).toLocaleDateString();
            const expiresDate = new Date(invitation.expiresAt).toLocaleDateString();

            return (
              <tr key={invitation.id} className={expired ? 'expired' : ''}>
                <td className="email-cell">{invitation.email}</td>
                <td className="role-cell">{invitation.role}</td>
                <td className="date-cell">{sentDate}</td>
                <td className={`date-cell ${expired ? 'error' : ''}`}>
                  {expiresDate}
                  {expired && <span className="expired-badge">Expired</span>}
                </td>
                <td className="actions-cell">
                  <button
                    onClick={() => handleResend(invitation.id, invitation.email)}
                    disabled={isLoading === invitation.id}
                    className="action-btn resend-btn"
                    title="Resend invitation"
                  >
                    <Mail size={16} />
                    {isLoading === invitation.id ? 'Sending...' : 'Resend'}
                  </button>
                  <button
                    onClick={() => handleRevoke(invitation.id, invitation.email)}
                    disabled={isLoading === invitation.id}
                    className="action-btn revoke-btn"
                    title="Revoke invitation"
                  >
                    <Trash2 size={16} />
                    Revoke
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <style jsx>{`
        .table-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .error-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .close-btn {
          background: none;
          border: none;
          color: #dc2626;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0;
        }

        .empty-state {
          text-align: center;
          padding: 2rem 1rem;
          color: #666;
          background: #f9fafb;
          border-radius: 6px;
          border: 1px solid #e5e7eb;
        }

        .invitations-table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          overflow: hidden;
        }

        .invitations-table thead {
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .invitations-table th {
          padding: 1rem;
          text-align: left;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .invitations-table td {
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          font-size: 0.875rem;
          color: #1f2937;
        }

        .invitations-table tbody tr:last-child td {
          border-bottom: none;
        }

        .invitations-table tbody tr:hover {
          background: #f9fafb;
        }

        .invitations-table tbody tr.expired {
          opacity: 0.6;
        }

        .email-cell {
          font-weight: 500;
          font-family: monospace;
        }

        .role-cell {
          color: #666;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .date-cell {
          color: #666;
          font-size: 0.8rem;
        }

        .date-cell.error {
          color: #dc2626;
          font-weight: 500;
        }

        .expired-badge {
          display: inline-block;
          margin-left: 0.5rem;
          padding: 0.2rem 0.5rem;
          background: #fecaca;
          color: #991b1b;
          border-radius: 3px;
          font-size: 0.65rem;
          font-weight: 600;
        }

        .actions-cell {
          display: flex;
          gap: 0.5rem;
        }

        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          color: #374151;
        }

        .action-btn:hover:not(:disabled) {
          background: #f3f4f6;
          border-color: #9ca3af;
        }

        .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .resend-btn {
          color: #0369a1;
        }

        .resend-btn:hover:not(:disabled) {
          background: #e0f2fe;
          border-color: #0369a1;
        }

        .revoke-btn {
          color: #dc2626;
        }

        .revoke-btn:hover:not(:disabled) {
          background: #fee2e2;
          border-color: #dc2626;
        }

        @media (max-width: 768px) {
          .invitations-table {
            font-size: 0.8rem;
          }

          .invitations-table th,
          .invitations-table td {
            padding: 0.75rem;
          }

          .actions-cell {
            flex-direction: column;
            gap: 0.25rem;
          }

          .action-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
