import { redirect } from 'next/navigation';
import type { DataSource } from '@/data/source';
import { Shell } from '@/components/shell';
import { Onboarding } from '@/features/auth/components/auth-form';
import { Portfolio } from '@/features/workspace/components/portfolio';
import { JoinBuildingForm } from '@/features/firm-links/components/join-building-form';
import { ReviewInbox } from '@/features/firm-links/components/review-inbox';
import { FirmOwnerDashboard } from '@/features/dashboards/components/firm-owner';
import { StrataManagerDashboard } from '@/features/dashboards/components/strata-manager';
import { orSignIn } from './guard';

// The overview (`/workspace`, `/demo/workspace`). A firm owner gets the firm dashboard and a strata manager their
// day, where the data source has them; otherwise the plain building list. A single-building person goes straight
// to their building unless they arrived here after losing access to it.
export async function WorkspaceScreen({
  source,
  searchParams,
}: {
  source: DataSource;
  searchParams: Promise<{ notice?: string; code?: string }>;
}) {
  const { notice, code } = await searchParams;
  if (await orSignIn(source, source.isPlatformAdmin())) redirect(source.base + '/admin');
  const state = await orSignIn(source, source.workspace());
  if (!state.profile.account_type) return <Onboarding />;
  if (state.profile.account_type === 'single_building' && state.buildings[0] && notice !== 'access_removed')
    redirect(await source.landingPath());
  const [firms, dashboard] = await Promise.all([source.firmOrganizations(), source.workspaceDashboard()]);
  const joinForm = firms.length > 0 ? <JoinBuildingForm firms={firms} initialCode={code || ''} /> : undefined;
  const inbox =
    firms.length > 0 ? (
      <ReviewInbox items={await source.firmReviewInbox()} buildings={state.buildings} base={source.base} />
    ) : undefined;
  return (
    <Shell profile={state.profile} buildings={state.buildings}>
      {notice === 'access_removed' && (
        <p role="status" className="card" style={{ marginBottom: 20 }}>
          You no longer have access to that building, or it doesn’t exist.
        </p>
      )}
      {dashboard?.kind === 'firm_owner' ? (
        <FirmOwnerDashboard data={dashboard.data} joinForm={joinForm} />
      ) : dashboard?.kind === 'strata_manager' ? (
        <StrataManagerDashboard data={dashboard.data} joinForm={joinForm} reviewInbox={inbox} />
      ) : (
        <>
          <Portfolio {...state} />
          {joinForm && <div style={{ marginTop: 32 }}>{joinForm}</div>}
          {inbox}
        </>
      )}
    </Shell>
  );
}
