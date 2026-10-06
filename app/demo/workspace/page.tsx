import { redirect } from 'next/navigation';
import { demoSession } from '@/mock/session';
import { getStore } from '@/mock/store';
import { landingPath } from '@/mock/personas';
import { firmOf, isPlatformAdmin } from '@/mock/rules';
import { workspace, firmOrganizations, firmReviewInbox } from '@/mock/source';
import { firmOwnerDashboard, strataManagerDashboard } from '@/mock/dashboards';
import { Shell } from '@/components/shell';
import { JoinBuildingForm } from '@/features/firm-links/components/join-building-form';
import { ReviewInbox } from '@/features/firm-links/components/review-inbox';
import { Portfolio } from '@/features/workspace/components/portfolio';
import { FirmOwnerDashboard } from '@/features/dashboards/components/firm-owner';
import { StrataManagerDashboard } from '@/features/dashboards/components/strata-manager';
export const dynamic = 'force-dynamic';
// Mirrors app/(app)/workspace/page.tsx, reading the demo session's store as its person. Every demo person has an
// account type, so there is no onboarding step. The firm owner gets the firm dashboard; everyone else with more
// than one building gets the strata manager's day; a single-building person only lands here after losing access, and
// sees the plain overview with that notice. The platform admin has no buildings and goes to /demo/admin.
export default async function DemoWorkspacePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; code?: string }>;
}) {
  const session = await demoSession();
  if (!session) redirect('/demo');
  const { notice, code } = await searchParams;
  const s = getStore(session.sessionId),
    userId = session.persona.userId;
  if (isPlatformAdmin(s, userId)) redirect('/demo/admin');
  const state = workspace(s, userId);
  if (state.profile.account_type === 'single_building' && state.buildings[0] && notice !== 'access_removed')
    redirect(landingPath(session.persona, s));
  const firms = firmOrganizations(s, userId);
  const joinForm = firms.length > 0 ? <JoinBuildingForm firms={firms} initialCode={code || ''} /> : undefined;
  const firm = firmOf(s, userId),
    owner =
      firm != null &&
      s.orgMembers.some(
        (m) => m.user_id === userId && m.org_id === firm && m.role === 'org_owner' && m.status === 'active',
      );
  return (
    <Shell profile={state.profile} buildings={state.buildings}>
      {notice === 'access_removed' && (
        <p role="status" className="card" style={{ marginBottom: 20 }}>
          You no longer have access to that building, or it doesn’t exist.
        </p>
      )}
      {owner ? (
        <FirmOwnerDashboard data={firmOwnerDashboard(s, userId)} joinForm={joinForm} />
      ) : firm == null && state.profile.account_type === 'single_building' ? (
        <Portfolio {...state} />
      ) : (
        <StrataManagerDashboard
          data={strataManagerDashboard(s, userId)}
          joinForm={joinForm}
          reviewInbox={
            firms.length > 0 ? (
              <ReviewInbox items={firmReviewInbox(s, userId)} buildings={state.buildings} base="/demo" />
            ) : undefined
          }
        />
      )}
    </Shell>
  );
}
