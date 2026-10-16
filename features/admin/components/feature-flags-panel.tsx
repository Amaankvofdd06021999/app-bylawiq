'use client';

import { useState, useEffect } from 'react';
import { loadFeatureFlagsAction } from '../platform-actions';
import { toggleFeatureFlagAction } from '../platform-actions';

interface FeatureFlag {
  id: string;
  flag_name: string;
  enabled: boolean;
  description?: string;
  updated_at: string;
  updated_by?: string;
}

export function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load once on mount. State is set only when the request resolves; a late answer after unmount is ignored.
  useEffect(() => {
    let active = true;
    loadFeatureFlagsAction()
      .then((result) => {
        if (!active) return;
        if (!result.ok) throw new Error(result.error);
        setFlags(result.flags);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : 'Failed to load flags');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleToggle = async (flagName: string, currentState: boolean) => {
    try {
      const result = await toggleFeatureFlagAction({
        flagName,
        enabled: !currentState,
        description: flags.find((f) => f.flag_name === flagName)?.description,
      });

      if (result.ok) {
        setFlags((prev) =>
          prev.map((f) => (f.flag_name === flagName ? { ...f, enabled: !currentState } : f)),
        );
      } else {
        setError(result.error || 'Failed to toggle flag');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error toggling flag');
    }
  };

  if (loading) return <div className="loading">Loading feature flags...</div>;

  return (
    <div className="flags-panel">
      {error && <div className="error-message">{error}</div>}

      <div className="flags-list">
        {flags.length === 0 ? (
          <p className="empty">No feature flags configured</p>
        ) : (
          flags.map((flag) => (
            <div key={flag.id} className="flag-item">
              <div className="flag-info">
                <h3 className="flag-name">{flag.flag_name}</h3>
                {flag.description && <p className="flag-desc">{flag.description}</p>}
                <p className="flag-meta">Last updated: {new Date(flag.updated_at).toLocaleDateString()}</p>
              </div>
              <div className="flag-control">
                <div className={`toggle ${flag.enabled ? 'on' : 'off'}`}>
                  <input
                    type="checkbox"
                    checked={flag.enabled}
                    onChange={() => handleToggle(flag.flag_name, flag.enabled)}
                    className="checkbox"
                  />
                  <span className="toggle-label">{flag.enabled ? 'ON' : 'OFF'}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .flags-panel {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .loading {
          text-align: center;
          padding: 2rem;
          color: #666;
        }

        .empty {
          text-align: center;
          padding: 2rem;
          color: #999;
          margin: 0;
        }

        .error-message {
          padding: 0.75rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          font-size: 0.875rem;
        }

        .flags-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .flag-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          background: #f9fafb;
          transition: all 0.2s;
        }

        .flag-item:hover {
          background: white;
          border-color: #d1d5db;
        }

        .flag-info {
          flex: 1;
        }

        .flag-name {
          margin: 0 0 0.25rem 0;
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
          font-family: monospace;
        }

        .flag-desc {
          margin: 0.25rem 0;
          font-size: 0.875rem;
          color: #666;
        }

        .flag-meta {
          margin: 0.25rem 0 0 0;
          font-size: 0.75rem;
          color: #999;
        }

        .flag-control {
          display: flex;
          align-items: center;
          margin-left: 1rem;
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          background: #f3f4f6;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toggle.on {
          background: #dcfce7;
          border: 1px solid #86efac;
        }

        .toggle.off {
          background: #fee2e2;
          border: 1px solid #fecaca;
        }

        .checkbox {
          cursor: pointer;
          width: 18px;
          height: 18px;
        }

        .toggle-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #374151;
        }

        .toggle.on .toggle-label {
          color: #15803d;
        }

        .toggle.off .toggle-label {
          color: #991b1b;
        }
      `}</style>
    </div>
  );
}
