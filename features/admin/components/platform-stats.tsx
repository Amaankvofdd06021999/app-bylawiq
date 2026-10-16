'use client';

import { useEffect, useState } from 'react';
import { loadPlatformStatsAction } from '../platform-actions';

interface Stats {
  organizations: number;
  buildings: number;
  users: number;
  regionsWithKB: number;
}

export function PlatformStats() {
  const [stats, setStats] = useState<Stats>({
    organizations: 0,
    buildings: 0,
    users: 0,
    regionsWithKB: 0,
  });
  const [loading, setLoading] = useState(true);

  // Load once on mount. State is set only when the request resolves; a late answer after unmount is ignored.
  useEffect(() => {
    let active = true;
    loadPlatformStatsAction()
      .then((result) => {
        if (!active) return;
        if (!result.ok) throw new Error(result.error);
        setStats({
          organizations: result.organizations.length,
          buildings: result.buildings.length,
          users: result.users.length,
          regionsWithKB: result.regionalKbs.filter((kb) => kb.passage_count > 0).length,
        });
      })
      .catch((e: unknown) => {
        console.error('Failed to load stats:', e);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="stats-loading">Loading...</div>;
  }

  return (
    <div className="stats-grid">
      <StatCard label="Organizations" value={stats.organizations} icon="🏢" />
      <StatCard label="Buildings" value={stats.buildings} icon="🏢" />
      <StatCard label="Users" value={stats.users} icon="👥" />
      <StatCard label="KB Regions" value={stats.regionsWithKB} icon="📚" />

      <style jsx>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .stats-loading {
          padding: 2rem;
          text-align: center;
          color: #666;
        }
      `}</style>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-info">
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value.toLocaleString()}</p>
      </div>

      <style jsx>{`
        .stat-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 8px;
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .stat-icon {
          font-size: 2rem;
        }

        .stat-info {
          flex: 1;
        }

        .stat-label {
          margin: 0;
          font-size: 0.875rem;
          opacity: 0.9;
        }

        .stat-value {
          margin: 0.25rem 0 0 0;
          font-size: 1.75rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}
