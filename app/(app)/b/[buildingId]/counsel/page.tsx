import { notFound } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { ForbiddenError } from '@/lib/errors';
import { listAmendments, listCounselGrants } from '@/features/counsel/queries';
import { CounselAccessPanel } from '@/features/counsel/components/counsel-panels';

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
  const [amendments, grants] = await Promise.all([
    listAmendments(user, buildingId),
    listCounselGrants(user, buildingId),
  ]);
  return (
    <main className="workspace-page">
      <PageHeading
        title="External counsel"
        description="Give a lawyer time-limited, read-only access to one amendment, and end access at any time."
      />
      <CounselAccessPanel buildingId={buildingId} amendments={amendments} grants={grants} />
    </main>
  );
}
