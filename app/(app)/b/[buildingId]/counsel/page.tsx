import { notFound } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { ForbiddenError } from '@/lib/errors';
import { listAmendments, listCounselGrants } from '@/features/counsel/queries';
import { CounselAccessPanel } from '@/features/counsel/components/counsel-panels';
import { Shell } from '@/components/shell';
import { openBuilding } from '@/app/_screens/guard';
import { supabaseSource } from '@/data/supabase';

export const dynamic = 'force-dynamic';

export default async function CounselAccessPage({ params }: { params: Promise<{ buildingId: string }> }) {
  const { buildingId } = await params;
  const user = await requireUser();
  try {
    await requirePermission(user, 'bylaw.adopt', buildingId);
  } catch (e) {
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  const source = supabaseSource();
  const state = await openBuilding(source, buildingId);
  const [amendments, grants] = await Promise.all([
    listAmendments(user, buildingId),
    listCounselGrants(user, buildingId),
  ]);

  return (
    <Shell
      profile={state.profile}
      buildings={state.buildings}
      activeId={buildingId}
      permissions={state.permissions}
      unreadUpdates={state.unreadUpdates}
      {...state.nav}
    >
      <main className="workspace-page" style={{ padding: '2rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        <PageHeading
          title="External counsel"
          description="Give a lawyer time-limited, read-only access to one amendment, and end access at any time."
        />
        <CounselAccessPanel buildingId={buildingId} amendments={amendments} grants={grants} />
      </main>
    </Shell>
  );
}
