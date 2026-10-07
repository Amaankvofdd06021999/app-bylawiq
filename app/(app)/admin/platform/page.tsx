import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { FeatureFlagsPanel } from '@/features/admin/components/feature-flags-panel';
import { PlatformAuditLog } from '@/features/admin/components/platform-audit-log';
import { PlatformStats } from '@/features/admin/components/platform-stats';

export default async function PlatformAdminPage() {
  const user = await requireUser();
  const db = await createClient();

  // Verify platform admin
  const { data: admin } = await db.auth.getUser();
  if (admin?.user?.user_metadata?.role !== 'platform_admin') {
    redirect('/');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Platform Admin Console</h1>
        <p className="subtitle">System-wide management and monitoring</p>
      </div>

      <div className="admin-grid">
        {/* Statistics Overview */}
        <section className="stats-section">
          <h2>Platform Overview</h2>
          <PlatformStats />
        </section>

        {/* Feature Flags */}
        <section className="feature-flags-section">
          <h2>Feature Flags</h2>
          <FeatureFlagsPanel />
        </section>

        {/* Audit Log */}
        <section className="audit-section">
          <h2>Activity Audit Log</h2>
          <p className="section-desc">All platform admin actions (immutable)</p>
          <PlatformAuditLog />
        </section>
      </div>

      <style jsx>{`
        .page-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .page-header {
          margin-bottom: 2rem;
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

        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
        }

        section {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
        }

        section h2 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
        }

        .section-desc {
          margin: 0 0 1rem 0;
          font-size: 0.875rem;
          color: #666;
        }

        .stats-section {
          grid-column: 1 / -1;
        }

        .audit-section {
          grid-column: 1 / -1;
        }

        @media (max-width: 1024px) {
          .admin-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
