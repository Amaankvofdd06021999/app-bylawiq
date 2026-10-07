'use client';
import { useState } from 'react';
import { Mail, Trash2 } from 'lucide-react';
import { Button, Card, Empty } from '@/components/ui';
import { resendInvitationAction, revokeInvitationAction } from '../actions';
import type { PendingInvitation } from '../queries';

interface PendingInvitationsProps {
  invitations: PendingInvitation[];
  onRefresh?: () => void;
}

export function PendingInvitations({ invitations, onRefresh }: PendingInvitationsProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!invitations.length) {
    return (
      <Empty
        icon={<Mail size={40} />}
        title="No pending invitations"
        description="All invited team members have joined or invitations have expired."
      />
    );
  }

  const handleResend = async (invitationId: string) => {
    setBusy(true);
    setError('');
    const result = await resendInvitationAction({ invitationId });
    setBusy(false);

    if (result.ok) {
      onRefresh?.();
    } else {
      setError(result.error);
    }
  };

  const handleRevoke = async (invitationId: string, email: string) => {
    if (!confirm(`Revoke invitation for ${email}?`)) return;

    setBusy(true);
    setError('');
    const result = await revokeInvitationAction({ invitationId });
    setBusy(false);

    if (result.ok) {
      onRefresh?.();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="space-y-3">
      {error && <p className="form-error">{error}</p>}

      {invitations.map((inv) => (
        <Card key={inv.id} className="invitation-card">
          <div className="invitation-content">
            <div>
              <p className="font-medium">{inv.email}</p>
              <p className="text-small text-muted">
                Invited {new Date(inv.createdAt).toLocaleDateString()} • Role:{' '}
                <span className="badge">{inv.role}</span>
              </p>
            </div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="small"
                title="Resend invitation"
                busy={busy}
                onClick={() => handleResend(inv.id)}
              >
                <Mail size={14} />
              </Button>

              <Button
                variant="ghost"
                size="small"
                tone="error"
                title="Revoke invitation"
                busy={busy}
                onClick={() => handleRevoke(inv.id, inv.email)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          <p className="text-small text-muted mt-2">
            Expires {new Date(inv.expiresAt).toLocaleDateString()}
          </p>
        </Card>
      ))}

      <style jsx>{`
        .invitation-card {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .invitation-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .space-y-3 > * + * {
          margin-top: 0.75rem;
        }
      `}</style>
    </div>
  );
}
