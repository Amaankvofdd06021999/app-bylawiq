'use client';
import { useState } from 'react';
import { Button, Input, Select, Card } from '@/components/ui';
import { inviteTeamMemberAction } from '../actions';

interface InviteFormProps {
  onSuccess?: () => void;
}

export function InviteForm({ onSuccess }: InviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('portfolio_manager');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);

    const result = await inviteTeamMemberAction({ email, role });
    setBusy(false);

    if (result.ok) {
      setSuccess(`Invitation sent to ${email}`);
      setEmail('');
      setRole('portfolio_manager');
      onSuccess?.();
    } else {
      setError(result.error);
    }
  };

  return (
    <Card className="invite-form-card">
      <h3>Invite Team Member</h3>
      <form onSubmit={handleSubmit} className="form-group-vertical">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            disabled={busy}
          />
        </div>

        <div className="form-group">
          <label htmlFor="role">Role</label>
          <Select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
          >
            <option value="portfolio_manager">Portfolio Manager</option>
            <option value="portfolio_assistant">Assistant Manager</option>
            <option value="org_admin">Admin</option>
            <option value="org_owner">Organization Owner</option>
          </Select>
          <p className="form-note">
            Portfolio Managers can draft and manage documents. Admins can also invite team members.
          </p>
        </div>

        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}

        <div className="form-actions">
          <Button type="submit" busy={busy} disabled={!email || busy}>
            Send Invitation
          </Button>
        </div>
      </form>

      <style jsx>{`
        .invite-form-card {
          max-width: 400px;
        }

        .form-group-vertical {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
        }
      `}</style>
    </Card>
  );
}
