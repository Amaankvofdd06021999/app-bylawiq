import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PortfolioDashboard } from '@/features/portfolio/components/portfolio-dashboard';

export default async function PortfolioPage() {
  const user = await requireUser().catch(() => redirect('/login'));
  const db = await createClient();

  // Verify user is multi-building (strata manager or firm staff)
  const { data: staffMemberships } = await db
    .from('building_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .neq('role', 'owner_resident')
    .limit(1);

  const { data: firmMemberships } = await db
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1);

  if (
    (!staffMemberships || staffMemberships.length === 0) &&
    (!firmMemberships || firmMemberships.length === 0)
  ) {
    redirect('/workspace');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Portfolio Dashboard</h1>
        <p className="subtitle">Overview of all buildings you manage</p>
      </div>

      <PortfolioDashboard userId={user.id} />

      <style>{`
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
      `}</style>
    </div>
  );
}
