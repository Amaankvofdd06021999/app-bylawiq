'use client';
import { useState } from 'react';
import { Building2, Users, FileText, AlertCircle, CheckCircle, Clock, Trash2 } from 'lucide-react';
import { Button, Card, Empty, Badge } from '@/components/ui';
import { revokeBuildingLinkAction } from '../building-actions';
import type { LinkedBuilding } from '../linked-buildings-queries';

interface LinkedBuildingsTableProps {
  buildings: LinkedBuilding[];
  onRevoke?: () => void;
}

const statusConfig = {
  pending: {
    icon: <Clock size={16} />,
    label: 'Pending Accept',
    color: 'warning',
    description: 'Waiting for building manager to accept link',
  },
  active: {
    icon: <CheckCircle size={16} />,
    label: 'Active',
    color: 'success',
    description: 'Firm has access to this building',
  },
  revoked: {
    icon: <AlertCircle size={16} />,
    label: 'Revoked',
    color: 'error',
    description: 'Access removed',
  },
};

export function LinkedBuildingsTable({ buildings, onRevoke }: LinkedBuildingsTableProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!buildings.length) {
    return (
      <Empty
        icon={<Building2 size={40} />}
        title="No linked buildings yet"
        description="Buildings will appear here once they invite your firm via code."
      />
    );
  }

  const handleRevoke = async (linkId: string, buildingName: string) => {
    if (
      !confirm(
        `Revoke access to ${buildingName}? Firm staff will lose access to this building's data immediately.`,
      )
    ) {
      return;
    }

    setBusy(true);
    setError('');
    const result = await revokeBuildingLinkAction({ linkId });
    setBusy(false);

    if (result.ok) {
      onRevoke?.();
    } else {
      setError(result.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="form-error">{error}</p>}

      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-2">
        {buildings.map((building) => (
          <Card key={building.id} className="building-card">
            <div className="building-header">
              <div className="flex items-start gap-3 flex-1">
                <div className="building-icon">
                  <Building2 size={24} />
                </div>
                <div className="flex-1">
                  <h3>{building.buildingName}</h3>
                  <p className="text-small text-muted">
                    {building.buildingJurisdiction} • Linked{' '}
                    {new Date(building.linkedAt || new Date()).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <Badge tone={statusConfig[building.status].color as 'success' | 'warning' | 'error'}>
                {statusConfig[building.status].label}
              </Badge>
            </div>

            <div className="building-metrics">
              <div className="metric">
                <FileText size={16} />
                <div>
                  <p className="text-small text-muted">Documents</p>
                  <p className="font-medium">{building.documentCount}</p>
                </div>
              </div>

              <div className="metric">
                <Users size={16} />
                <div>
                  <p className="text-small text-muted">Staff</p>
                  <p className="font-medium">{building.staffCount}</p>
                </div>
              </div>

              <div className="metric">
                <AlertCircle size={16} />
                <div>
                  <p className="text-small text-muted">Disputes</p>
                  <p className="font-medium">{building.disputeCount}</p>
                </div>
              </div>
            </div>

            {building.status === 'pending' && (
              <p className="text-small text-warning p-2 bg-yellow-50 rounded">
                📋 Building manager needs to accept this link invitation to activate access.
              </p>
            )}

            {building.status === 'active' && (
              <div className="building-actions">
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => handleRevoke(building.id, building.buildingName)}
                  busy={busy}
                  disabled={busy}
                >
                  <Trash2 size={14} />
                  Revoke Access
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>

      <style jsx>{`
        .space-y-4 > * + * {
          margin-top: 1rem;
        }

        .building-card {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .building-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .building-header h3 {
          margin: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }

        .building-icon {
          padding: 0.5rem;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .building-metrics {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          padding: 1rem;
          background: var(--color-bg-secondary);
          border-radius: var(--radius-md);
        }

        .metric {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }

        .metric svg {
          flex-shrink: 0;
          margin-top: 0.25rem;
          color: var(--color-text-secondary);
        }

        .building-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        @media (max-width: 768px) {
          .building-metrics {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
