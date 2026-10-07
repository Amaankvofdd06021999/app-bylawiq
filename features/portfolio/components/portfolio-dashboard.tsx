'use client';

import { useEffect, useState } from 'react';
import { getPortfolioDashboard, getPortfolioAnalytics } from '../portfolio-queries';
import { Building, FileText, AlertCircle, Users } from 'lucide-react';

interface Building {
  id: string;
  name: string;
  city: string;
  resident_count: number;
  document_count: number;
  dispute_count: number;
}

interface Stats {
  totalBuildings: number;
  buildings: Building[];
  stats: {
    totalDocuments: number;
    totalDisputes: number;
    totalResidents: number;
  };
}

interface Analytics {
  documentsCreated: number;
  documentsApproved: number;
  documentsSent: number;
  disputesCreated: number;
  disputesClosed: number;
  residentsActive: number;
}

interface PortfolioDashboardProps {
  userId: string;
}

export function PortfolioDashboard({ userId }: PortfolioDashboardProps) {
  const [dashboard, setDashboard] = useState<Stats | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    try {
      const [dashboardData, analyticsData] = await Promise.all([
        getPortfolioDashboard(userId),
        getPortfolioAnalytics(userId),
      ]);

      setDashboard(dashboardData);
      setAnalytics(analyticsData);
    } catch (e) {
      console.error('Failed to load portfolio data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading portfolio...</div>;
  }

  if (!dashboard || dashboard.totalBuildings === 0) {
    return (
      <div className="empty-state">
        <Building size={48} />
        <h2>No buildings yet</h2>
        <p>You haven't been assigned to manage any buildings yet.</p>
      </div>
    );
  }

  return (
    <div className="portfolio">
      {/* Summary Cards */}
      <div className="summary-grid">
        <SummaryCard
          label="Buildings"
          value={dashboard.totalBuildings}
          icon={<Building size={24} />}
          color="blue"
        />
        <SummaryCard
          label="Residents"
          value={dashboard.stats.totalResidents}
          icon={<Users size={24} />}
          color="green"
        />
        <SummaryCard
          label="Documents"
          value={dashboard.stats.totalDocuments}
          icon={<FileText size={24} />}
          color="purple"
        />
        <SummaryCard
          label="Disputes"
          value={dashboard.stats.totalDisputes}
          icon={<AlertCircle size={24} />}
          color="orange"
        />
      </div>

      {/* Buildings Grid */}
      <section className="buildings-section">
        <h2>Your Buildings</h2>
        <div className="buildings-grid">
          {dashboard.buildings.map((building) => (
            <div key={building.id} className="building-card">
              <h3 className="building-name">{building.name}</h3>
              <p className="building-city">{building.city}</p>

              <div className="metrics">
                <div className="metric">
                  <span className="metric-label">Residents</span>
                  <span className="metric-value">{building.resident_count}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Documents</span>
                  <span className="metric-value">{building.document_count}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Disputes</span>
                  <span className="metric-value">{building.dispute_count}</span>
                </div>
              </div>

              <a href={`/b/${building.id}`} className="view-link">
                View Building →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Analytics */}
      {analytics && (
        <section className="analytics-section">
          <h2>Activity Overview</h2>
          <div className="analytics-grid">
            <AnalyticsCard label="Documents Created" value={analytics.documentsCreated} />
            <AnalyticsCard label="Documents Approved" value={analytics.documentsApproved} />
            <AnalyticsCard label="Documents Sent" value={analytics.documentsSent} />
            <AnalyticsCard label="Disputes Created" value={analytics.disputesCreated} />
            <AnalyticsCard label="Disputes Closed" value={analytics.disputesClosed} />
          </div>
        </section>
      )}

      <style jsx>{`
        .portfolio {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .loading {
          padding: 2rem;
          text-align: center;
          color: #666;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .empty-state svg {
          color: #d1d5db;
          margin-bottom: 1rem;
        }

        .empty-state h2 {
          margin: 0.5rem 0;
          color: #1f2937;
        }

        .empty-state p {
          margin: 0;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }

        .buildings-section,
        .analytics-section {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .buildings-section h2,
        .analytics-section h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }

        .buildings-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .building-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: white;
          transition: all 0.2s;
        }

        .building-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .building-name {
          margin: 0 0 0.25rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .building-city {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #666;
        }

        .metrics {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .metric {
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .metric-label {
          font-size: 0.75rem;
          color: #666;
          font-weight: 500;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1f2937;
        }

        .view-link {
          color: #3b82f6;
          text-decoration: none;
          font-weight: 500;
          font-size: 0.875rem;
        }

        .view-link:hover {
          text-decoration: underline;
        }

        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
        }
      `}</style>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    blue: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
    green: { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
    purple: { bg: '#f3e8ff', border: '#d8b4fe', text: '#6b21a8' },
    orange: { bg: '#fed7aa', border: '#fdba74', text: '#b45309' },
  };

  const c = colors[color];

  return (
    <div className="card" style={{ borderColor: c.border, backgroundColor: c.bg }}>
      <div className="icon" style={{ color: c.text }}>
        {icon}
      </div>
      <div className="content">
        <p className="label">{label}</p>
        <p className="value" style={{ color: c.text }}>
          {value.toLocaleString()}
        </p>
      </div>
      <style jsx>{`
        .card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.5rem;
          border: 2px solid;
          border-radius: 8px;
        }

        .icon {
          flex-shrink: 0;
        }

        .content {
          flex: 1;
        }

        .label {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
        }

        .value {
          margin: 0.25rem 0 0 0;
          font-size: 1.75rem;
          font-weight: 700;
        }
      `}</style>
    </div>
  );
}

function AnalyticsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="analytics-card">
      <p className="label">{label}</p>
      <p className="value">{value}</p>
      <style jsx>{`
        .analytics-card {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          background: #f9fafb;
        }

        .label {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
          font-weight: 500;
        }

        .value {
          margin: 0.5rem 0 0 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
}
