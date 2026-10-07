'use client';

import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { UserPlus, Trash2, Mail, Calendar } from 'lucide-react';
import { getResidentsAction, removeResidentAction } from '../resident-management-actions';
import { InviteResidentModal } from './invite-resident-modal';

interface Resident {
  userId: string;
  email: string;
  name: string;
  unitNumber?: string;
  joinedAt: string;
}

interface ResidentManagementProps {
  buildingId: string;
  buildingName: string;
}

export function ResidentManagement({ buildingId, buildingName }: ResidentManagementProps) {
  const [residents, setResidents] = useState<Resident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadResidents();
  }, []);

  const loadResidents = async () => {
    try {
      setLoading(true);
      const result = await getResidentsAction({ buildingId });

      if (result.ok) {
        setResidents(result.residents || []);
      } else {
        setError(result.error || 'Failed to load residents');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading residents');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Remove this resident from the building?')) return;

    try {
      setDeleting(userId);
      const result = await removeResidentAction({
        buildingId,
        userId,
      });

      if (result.ok) {
        setResidents((prev) => prev.filter((r) => r.userId !== userId));
      } else {
        setError(result.error || 'Failed to remove resident');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error removing resident');
    } finally {
      setDeleting(null);
    }
  };

  const handleInviteSuccess = () => {
    setShowInviteModal(false);
    loadResidents();
  };

  if (loading) {
    return <div className="loading">Loading residents...</div>;
  }

  return (
    <div className="resident-management">
      {error && <div className="error-message">{error}</div>}

      <div className="header-actions">
        <Button onClick={() => setShowInviteModal(true)} className="invite-btn">
          <UserPlus size={18} />
          Invite Resident
        </Button>
      </div>

      {residents.length === 0 ? (
        <Card className="empty-state">
          <h2>No residents yet</h2>
          <p>Invite residents to give them access to building information.</p>
        </Card>
      ) : (
        <div className="residents-table">
          <div className="table-header">
            <div className="col-name">Name</div>
            <div className="col-email">Email</div>
            <div className="col-unit">Unit Number</div>
            <div className="col-joined">Joined</div>
            <div className="col-actions">Actions</div>
          </div>

          {residents.map((resident) => (
            <div key={resident.userId} className="table-row">
              <div className="col-name">
                <p className="resident-name">{resident.name}</p>
              </div>
              <div className="col-email">
                <div className="email-cell">
                  <Mail size={14} />
                  <a href={`mailto:${resident.email}`}>{resident.email}</a>
                </div>
              </div>
              <div className="col-unit">
                <p className="unit">{resident.unitNumber || '—'}</p>
              </div>
              <div className="col-joined">
                <div className="date-cell">
                  <Calendar size={14} />
                  {new Date(resident.joinedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="col-actions">
                <Button
                  onClick={() => handleRemove(resident.userId)}
                  disabled={deleting === resident.userId}
                  variant="danger"
                  size="sm"
                >
                  <Trash2 size={14} />
                  {deleting === resident.userId ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInviteModal && (
        <InviteResidentModal
          buildingId={buildingId}
          onClose={() => setShowInviteModal(false)}
          onSuccess={handleInviteSuccess}
        />
      )}

      <style jsx>{`
        .resident-management {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .loading {
          padding: 2rem;
          text-align: center;
          color: #666;
        }

        .error-message {
          padding: 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .header-actions {
          display: flex;
          gap: 1rem;
        }

        .invite-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .empty-state h2 {
          margin: 0.5rem 0;
          color: #1f2937;
        }

        .empty-state p {
          margin: 0;
        }

        .residents-table {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .table-header {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr 1.5fr 1fr;
          gap: 1rem;
          padding: 1rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
          font-weight: 600;
          font-size: 0.875rem;
          color: #374151;
        }

        .table-row {
          display: grid;
          grid-template-columns: 2fr 2fr 1fr 1.5fr 1fr;
          gap: 1rem;
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
          align-items: center;
          background: white;
          transition: background 0.2s;
        }

        .table-row:hover {
          background: #f9fafb;
        }

        .table-row:last-child {
          border-bottom: none;
        }

        .resident-name {
          margin: 0;
          font-weight: 500;
          color: #1f2937;
        }

        .email-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .email-cell a {
          color: #3b82f6;
          text-decoration: none;
        }

        .email-cell a:hover {
          text-decoration: underline;
        }

        .unit {
          margin: 0;
          color: #666;
          font-size: 0.875rem;
        }

        .date-cell {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #666;
        }

        .col-actions {
          display: flex;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
