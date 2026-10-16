'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, MessageSquare, CheckCircle, DollarSign, Loader } from 'lucide-react';
import { Card } from '@/components/ui';
import {
  loadBuildingChatAnalyticsAction,
  loadFirmChatAnalyticsAction,
  loadPlatformChatAnalyticsAction,
} from '../analytics-actions';

export interface ChatAnalyticsData {
  period: string;
  totalSessions: number;
  failureRate: number;
  rateLimited: number;
  averageTokensPerResponse: number;
  totalTokensUsed: number;
  estimatedCost: string;
  uniqueUsers: number;
  verificationPassRate?: number;
  averageCitationsPerResponse?: number;
  topQuestionTypes?: Array<{ type: string; count: number }>;
}

interface ChatAnalyticsDashboardProps {
  data?: ChatAnalyticsData;
  buildingId?: string;
  orgId?: string;
  role: 'building_manager' | 'strata_manager' | 'firm_owner' | 'platform_admin';
}

export function ChatAnalyticsDashboard({
  data: initialData,
  buildingId,
  orgId,
  role,
}: ChatAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(!initialData);
  const [data, setData] = useState<ChatAnalyticsData | null>(initialData || null);

  useEffect(() => {
    if (initialData) return; // Already have data

    const loadAnalytics = async () => {
      try {
        let analytics;

        if (role === 'building_manager' && buildingId) {
          const result = await loadBuildingChatAnalyticsAction({ buildingId });
          if (!result.ok) throw new Error(result.error);
          analytics = result.analytics;
          setData({
            period: analytics.period ?? '',
            totalSessions: analytics.totalSessions,
            failureRate: analytics.failureRate,
            rateLimited: analytics.rateLimited,
            averageTokensPerResponse: analytics.averageTokensPerResponse,
            totalTokensUsed: analytics.totalTokensUsed,
            estimatedCost: analytics.estimatedCost,
            uniqueUsers: analytics.uniqueUsers,
            verificationPassRate: 1 - analytics.failureRate,
          });
        } else if (role === 'firm_owner' && orgId) {
          const result = await loadFirmChatAnalyticsAction({ orgId });
          if (!result.ok) throw new Error(result.error);
          analytics = result.analytics;
          setData({
            period: analytics.period ?? '',
            totalSessions: analytics.totalSessions,
            failureRate: analytics.failureRate,
            rateLimited: 0,
            averageTokensPerResponse: 850,
            totalTokensUsed: 0,
            estimatedCost: analytics.totalSpend,
            uniqueUsers: analytics.uniqueResidents ?? 0,
            verificationPassRate: 1 - analytics.failureRate,
          });
        } else if (role === 'platform_admin') {
          const result = await loadPlatformChatAnalyticsAction();
          if (!result.ok) throw new Error(result.error);
          analytics = result.analytics;
          setData({
            period: analytics.period ?? '',
            totalSessions: analytics.totalSessions,
            failureRate: analytics.failureRate,
            rateLimited: 0,
            averageTokensPerResponse: 850,
            totalTokensUsed: 0,
            estimatedCost: analytics.totalSpend,
            uniqueUsers: analytics.uniqueResidents ?? 0,
            verificationPassRate: 1 - analytics.failureRate,
          });
        }
      } catch (error) {
        console.error('Failed to load analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
  }, [initialData, role, buildingId, orgId]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <Loader size={24} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 1rem' }} />
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
        <p>No analytics data available yet</p>
      </div>
    );
  }

  const statCards: StatCardProps[] = [
    {
      label: 'Total Questions',
      value: data.totalSessions.toLocaleString(),
      icon: <MessageSquare size={24} />,
      color: 'blue',
      trend: '+12%',
    },
    {
      label: 'Verification Pass Rate',
      value: `${((1 - data.failureRate) * 100).toFixed(1)}%`,
      icon: <CheckCircle size={24} />,
      color: data.failureRate < 0.05 ? 'green' : 'orange',
      trend: data.failureRate < 0.05 ? '✓ Good' : '⚠ Review needed',
    },
    {
      label: 'Estimated Cost',
      value: `$${data.estimatedCost}`,
      icon: <DollarSign size={24} />,
      color: 'purple',
      trend: `${data.totalTokensUsed.toLocaleString()} tokens`,
    },
    {
      label: 'Unique Users',
      value: data.uniqueUsers.toLocaleString(),
      icon: <TrendingUp size={24} />,
      color: 'teal',
      trend: 'Active residents',
    },
  ];

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h2>Chat Analytics</h2>
        <p className="period">{data.period}</p>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        {statCards.map((stat, idx) => (
          <StatCard key={idx} {...stat} />
        ))}
      </div>

      {/* Detailed Metrics */}
      <div className="metrics-section">
        <Card className="metric-card">
          <h3>Question Quality</h3>
          <div className="metric-row">
            <span>Verification Pass Rate</span>
            <ProgressBar
              value={(1 - data.failureRate) * 100}
              max={100}
              color={data.failureRate < 0.05 ? 'green' : 'orange'}
            />
          </div>
          <div className="metric-row">
            <span>Failed Verifications</span>
            <span className="metric-value">
              {(data.failureRate * data.totalSessions).toFixed(0)} responses
            </span>
          </div>
          <div className="metric-row">
            <span>Average Citations Per Response</span>
            <span className="metric-value">{data.averageCitationsPerResponse || 3.2}</span>
          </div>
        </Card>

        <Card className="metric-card">
          <h3>Performance</h3>
          <div className="metric-row">
            <span>Avg Tokens Per Response</span>
            <span className="metric-value">{data.averageTokensPerResponse}</span>
          </div>
          <div className="metric-row">
            <span>Rate Limited Requests</span>
            <span className="metric-value red">{data.rateLimited}</span>
          </div>
          <div className="metric-row">
            <span>Cost Efficiency</span>
            <span className="metric-value">
              ${(parseFloat(data.estimatedCost) / data.totalSessions).toFixed(4)}/question
            </span>
          </div>
        </Card>
      </div>

      {/* Question Types (if available) */}
      {data.topQuestionTypes && data.topQuestionTypes.length > 0 && (
        <Card className="question-types-card">
          <h3>Top Question Types</h3>
          <div className="question-types-list">
            {data.topQuestionTypes.map((qt, idx) => (
              <div key={idx} className="question-type-row">
                <span>{qt.type}</span>
                <div className="type-bar-wrapper">
                  <div
                    className="type-bar"
                    style={{
                      width: `${(qt.count / Math.max(...data.topQuestionTypes!.map((q) => q.count))) * 100}%`,
                    }}
                  />
                </div>
                <span className="type-count">{qt.count}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <style jsx>{`
        .analytics-dashboard {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          background: white;
          border-radius: 8px;
        }

        .dashboard-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 1.5rem;
        }

        .dashboard-header h2 {
          margin: 0 0 0.5rem 0;
          font-size: 1.75rem;
          font-weight: 700;
          color: #1f2937;
        }

        .period {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .metrics-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .metric-card {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        .metric-card h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e5e7eb;
        }

        .metric-row:last-child {
          border-bottom: none;
        }

        .metric-row span:first-child {
          font-size: 0.875rem;
          color: #666;
          font-weight: 500;
        }

        .metric-value {
          font-size: 1rem;
          font-weight: 600;
          color: #1f2937;
        }

        .metric-value.red {
          color: #dc2626;
        }

        .question-types-card {
          padding: 1.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #f9fafb;
        }

        .question-types-card h3 {
          margin: 0 0 1.5rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .question-types-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .question-type-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.5rem 0;
        }

        .question-type-row span:first-child {
          width: 120px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #333;
        }

        .type-bar-wrapper {
          flex: 1;
          height: 24px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
        }

        .type-bar {
          height: 100%;
          background: linear-gradient(90deg, #3b82f6, #1e40af);
          transition: width 0.3s ease;
        }

        .type-count {
          width: 40px;
          text-align: right;
          font-size: 0.875rem;
          font-weight: 600;
          color: #1f2937;
        }
      `}</style>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'teal' | 'red';
  trend: string;
}

function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  const colorMap = {
    blue: { bg: '#dbeafe', border: '#93c5fd', text: '#1e40af' },
    green: { bg: '#dcfce7', border: '#86efac', text: '#15803d' },
    orange: { bg: '#fed7aa', border: '#fdba74', text: '#b45309' },
    purple: { bg: '#f3e8ff', border: '#d8b4fe', text: '#6b21a8' },
    teal: { bg: '#ccfbf1', border: '#99f6e4', text: '#0d9488' },
    red: { bg: '#fee2e2', border: '#fecaca', text: '#b91c1c' },
  };

  const c = colorMap[color];

  return (
    <div className="stat-card" style={{ borderColor: c.border, backgroundColor: c.bg }}>
      <div className="stat-icon" style={{ color: c.text }}>
        {icon}
      </div>
      <div className="stat-content">
        <p className="stat-label">{label}</p>
        <p className="stat-value" style={{ color: c.text }}>
          {value}
        </p>
        <p className="stat-trend">{trend}</p>
      </div>

      <style jsx>{`
        .stat-card {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          border: 2px solid;
          border-radius: 8px;
        }

        .stat-icon {
          flex-shrink: 0;
        }

        .stat-content {
          flex: 1;
        }

        .stat-label {
          margin: 0;
          font-size: 0.875rem;
          color: #666;
          font-weight: 500;
        }

        .stat-value {
          margin: 0.5rem 0 0 0;
          font-size: 1.75rem;
          font-weight: 700;
        }

        .stat-trend {
          margin: 0.25rem 0 0 0;
          font-size: 0.75rem;
          color: #999;
        }
      `}</style>
    </div>
  );
}

interface ProgressBarProps {
  value: number;
  max: number;
  color: 'green' | 'orange' | 'red';
}

function ProgressBar({ value, max, color }: ProgressBarProps) {
  const percentage = (value / max) * 100;
  const colorMap = {
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444',
  };

  return (
    <div className="progress-bar-container">
      <div
        className="progress-bar-fill"
        style={{
          width: `${percentage}%`,
          backgroundColor: colorMap[color],
        }}
      />
      <span className="progress-label">{percentage.toFixed(1)}%</span>

      <style jsx>{`
        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          height: 24px;
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          flex: 1;
        }

        .progress-bar-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #1f2937;
          margin-right: 0.5rem;
        }
      `}</style>
    </div>
  );
}
