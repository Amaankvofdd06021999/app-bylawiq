import { notFound } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { ForbiddenError } from '@/lib/errors';
import { getNoticeForDelivery, listNoticeDeliveries } from '@/features/notices/delivery-queries';
import { NoticeDeliveryPanel } from '@/features/notices/components/delivery-panel';

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

  const notice = await getNoticeForDelivery(user, buildingId, noticeId);
  if (!notice) notFound();
  const deliveries = await listNoticeDeliveries(user, noticeId);

  return (
    <main className="workspace-page">
      <PageHeading title={notice.title} description={`Notice status: ${notice.status.replace(/_/g, ' ')}`} />
      <NoticeDeliveryPanel
        buildingId={buildingId}
        noticeId={noticeId}
        noticeStatus={notice.status}
        deliveries={deliveries}
      />
    </main>
  );
}
