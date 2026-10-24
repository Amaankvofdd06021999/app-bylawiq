import { notFound } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { ForbiddenError } from '@/lib/errors';
import { getNoticeForDelivery, listNoticeDeliveries } from '@/features/notices/delivery-queries';
import { NoticeDeliveryPanel } from '@/features/notices/components/delivery-panel';
import { Shell } from '@/components/shell';
import { openBuilding } from '@/app/_screens/guard';
import { supabaseSource } from '@/data/supabase';

export const dynamic = 'force-dynamic';

export default async function NoticeDeliveryPage({
  params,
}: {
  params: Promise<{ buildingId: string; noticeId: string }>;
}) {
  const { buildingId, noticeId } = await params;
  const user = await requireUser();
  try {
    await requirePermission(user, 'bylaw.adopt', buildingId);
  } catch (e) {
    // Residents, other buildings and anyone else get the same answer as a missing page.
    if (e instanceof ForbiddenError) notFound();
    throw e;
  }

  const source = supabaseSource();
  const state = await openBuilding(source, buildingId);

  const notice = await getNoticeForDelivery(user, buildingId, noticeId);
  if (!notice) notFound();
  const deliveries = await listNoticeDeliveries(user, noticeId);

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
          title={notice.title}
          description={`Notice status: ${notice.status.replace(/_/g, ' ')}`}
        />
        <NoticeDeliveryPanel
          buildingId={buildingId}
          noticeId={noticeId}
          noticeStatus={notice.status}
          deliveries={deliveries}
        />
      </main>
    </Shell>
  );
}
