'use client';
import { useState } from 'react';
import { Trash2, Mail } from 'lucide-react';
import { Button, Empty } from '@/components/ui';
import { removeTeamMemberAction } from '../actions';
import type { TeamMember } from '../queries';

// Simple toast notification system
function showToast(message: string, type: 'success' | 'error' = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 24px;
    border-radius: 6px;
    background: ${type === 'success' ? '#10b981' : '#ef4444'};
    color: white;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    animation: slideIn 0.3s ease-out;
    z-index: 9999;
  `;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

interface TeamMembersTableProps {
  members: TeamMember[];
  onRemove?: () => void;
}

const roleLabels: Record<string, string> = {
  org_owner: 'Organization Owner',
  org_admin: 'Admin',
  portfolio_manager: 'Portfolio Manager',
  portfolio_assistant: 'Assistant Manager',
};

export function TeamMembersTable({ members, onRemove }: TeamMembersTableProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!members.length) {
    return (
      <Empty
        icon={<Mail size={40} />}
        title="No team members yet"
        description="Invite your first team member to get started."
      />
    );
  }

  const handleRemove = async (memberId: string, email: string) => {
    if (!confirm(`Remove ${email} from the team?`)) return;

    setBusy(true);
    setError('');
    const result = await removeTeamMemberAction({ memberId });
    setBusy(false);

    if (result.ok) {
      showToast(`Removed ${email} from team`, 'success');
      onRemove?.();
    } else {
      showToast(result.error || 'Failed to remove member', 'error');
      setError(result.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="form-error">{error}</p>}

      <div className="team-table">
        <div className="table-header">
          <div className="col-email">Email</div>
          <div className="col-role">Role</div>
          <div className="col-status">Status</div>
          <div className="col-joined">Joined</div>
          <div className="col-actions">Actions</div>
        </div>

        {members.map((member) => (
          <div key={member.id} className="table-row">
            <div className="col-email">
              <div className="flex items-center gap-2">
                <span className="avatar avatar-small" aria-hidden>
                  {member.displayName
                    ?.split(' ')
                    .map((w) => w[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase() || member.email[0].toUpperCase()}
                </span>
                <div>
                  <div className="font-medium">{member.displayName || 'Unnamed'}</div>
                  <div className="text-small text-muted">{member.email}</div>
                </div>
              </div>
            </div>

            <div className="col-role">
              <span className="badge">{roleLabels[member.role] || member.role}</span>
            </div>

            <div className="col-status">
              <span
                className={`badge ${
                  member.status === 'active'
                    ? 'badge-success'
                    : member.status === 'pending_invite'
                      ? 'badge-warning'
                      : 'badge-error'
                }`}
              >
                {member.status === 'active'
                  ? 'Active'
                  : member.status === 'pending_invite'
                    ? 'Pending Invite'
                    : 'Suspended'}
              </span>
            </div>

            <div className="col-joined text-small text-muted">
              {member.joinedAt
                ? new Date(member.joinedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                : '—'}
            </div>

            <div className="col-actions">
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="small"
                  title="Remove member"
                  busy={busy}
                  onClick={() => handleRemove(member.id, member.email)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .team-table {
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .table-header,
        .table-row {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 1rem;
          padding: 1rem;
          align-items: center;
          border-bottom: 1px solid var(--color-border);
        }

        .table-header {
          background: var(--color-bg-secondary);
          font-weight: 600;
          font-size: 0.875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .table-row:hover {
          background: var(--color-bg-secondary);
        }

        .col-email,
        .col-role,
        .col-status,
        .col-joined,
        .col-actions {
          /* Default */
        }

        @media (max-width: 768px) {
          .table-header,
          .table-row {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }

          .table-header {
            display: none;
          }

          .table-row {
            padding: 1.5rem;
            border-bottom: 1px solid var(--color-border);
            position: relative;
          }

          .table-row::before {
            content: attr(data-label);
            font-weight: 600;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: block;
            margin-bottom: 0.5rem;
            color: var(--color-text-secondary);
          }
        }
      `}</style>
    </div>
  );
}
