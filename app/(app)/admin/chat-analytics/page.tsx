import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ChatAnalyticsDashboard, type ChatAnalyticsData } from '@/features/chat/components/chat-analytics-dashboard';
import { getPlatformChatAnalytics } from '@/features/chat/citations-analytics';

export default async function AdminChatAnalyticsPage() {
  const user = await requireUser();
  const db = await createClient();

  // Verify user is platform admin
  const { data: admin } = await db
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!admin) {
    redirect('/');
  }

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>Chat & AI Analytics</h1>
        <p className="subtitle">System-wide performance and usage metrics</p>
      </div>

      <ChatAnalyticsDashboard role="platform_admin" />

      <style jsx>{`
        .analytics-page {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          padding: 2rem;
          background: white;
          border-radius: 8px;
        }

        .page-header {
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 1.5rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .subtitle {
          margin: 0;
          color: #666;
          font-size: 0.95rem;
        }

        .detailed-metrics {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .metric-section h3 {
          margin: 0 0 1rem 0;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1f2937;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .metric-box {
          padding: 1.5rem;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .metric-label {
          margin: 0 0 0.75rem 0;
          color: #666;
          font-size: 0.875rem;
          font-weight: 500;
        }

        .metric-value {
          margin: 0;
          color: #1f2937;
          font-size: 1.75rem;
          font-weight: 700;
        }

        @media (max-width: 768px) {
          .analytics-page {
            padding: 1rem;
          }

          .page-header h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
