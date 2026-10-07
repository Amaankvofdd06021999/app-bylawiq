'use client';

import { useEffect, useState } from 'react';
import { getPlatformAuditLogAction } from '../platform-actions';
import { AlertCircle, Lock } from 'lucide-react';

interface AuditEntry {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details: Record<string, any>;
  created_at: string;
  admin?: {
    display_name: string;
    email: string;
  };
}

export function PlatformAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  useEffect(() => {
    loadAuditLog();
  }, [selectedAction]);

  const loadAuditLog = async () => {
    try {
      setLoading(true);
      const result = await getPlatformAuditLogAction({
        limit: 50,
        action: selectedAction || undefined,
      });

      if (result.ok) {
        setEntries(result.audit || []);
      } else {
        setError(result.error || 'Failed to load audit log');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading audit log');
    } finally {
      setLoading(false);
    }
  };

  const actions = [
    'toggle_feature_flag',
    'grant_platform_admin',
    'revoke_platform_admin',
    'break_glass_read',
    'start_firm_onboarding',
    'complete_firm_onboarding',
  ];

  return (
    <div className="audit-log">
      {error && <div className="error-message">{error}</div>}

      <div className="filters">
        <select
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
          className="filter-select"
        >
          <option value="">All Actions</option>
          {actions.map((action) => (
            <option key={action} value={action}>
              {action.replace(/_/g, ' ').toUpperCase()}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading audit log...</div>
      ) : entries.length === 0 ? (
        <div className="empty">No audit entries found</div>
      ) : (
        <div className="entries">
          {entries.map((entry) => (
            <div key={entry.id} className="entry">
              <div className="entry-header">
                <div className="action-badge">
                  <Lock size={14} />
                  {entry.action.replace(/_/g, ' ')}
                </div>
                <span className="timestamp">
                  {new Date(entry.created_at).toLocaleString()}
                </span>
              </div>

              <div className="entry-body">
                <p className="admin">
                  <strong>Admin:</strong>{' '}
                  {entry.admin?.display_name || entry.admin_id}
                </p>
                <p className="resource">
                  <strong>Resource:</strong> {entry.resource_type}
                  {entry.resource_id && ` (${entry.resource_id.slice(0, 8)}...)`}
                </p>

                {entry.action === 'break_glass_read' && (
                  <div className="break-glass-warning">
                    <AlertCircle size={16} />
                    <span>HIGH RISK: Break-glass access</span>
                  </div>
                )}

                {entry.details && Object.keys(entry.details).length > 0 && (
                  <details className="details">
                    <summary>Details</summary>
                    <pre className="details-content">
                      {JSON.stringify(entry.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx>{`
        .audit-log {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .filters {
          display: flex;
          gap: 1rem;
        }

        .filter-select {
          padding: 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .loading,
        .empty {
          padding: 2rem;
          text-align: center;
          color: #666;
        }

        .entries {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          max-height: 600px;
          overflow-y: auto;
        }

        .entry {
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #f9fafb;
          padding: 1rem;
          transition: all 0.2s;
        }

        .entry:hover {
          background: white;
          border-color: #d1d5db;
        }

        .entry-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .action-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.8rem;
          background: #dbeafe;
          border: 1px solid #93c5fd;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #1e40af;
        }

        .timestamp {
          font-size: 0.75rem;
          color: #999;
        }

        .entry-body {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .admin,
        .resource {
          margin: 0;
          color: #374151;
        }

        .break-glass-warning {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: #fef2f2;
          border-left: 3px solid #dc2626;
          color: #dc2626;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .details {
          cursor: pointer;
        }

        .details summary {
          padding: 0.5rem 0;
          font-size: 0.8rem;
          color: #3b82f6;
          font-weight: 600;
          user-select: none;
        }

        .details-content {
          margin: 0.5rem 0 0 0;
          padding: 0.5rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.75rem;
          overflow-x: auto;
          max-height: 200px;
          overflow-y: auto;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}
