import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getLinkedBuildings } from '@/features/admin/linked-buildings-queries';
import { LinkedBuildingsTable } from '@/features/admin/components/linked-buildings-table';
import { BuildingLinkingInfo } from '@/features/admin/components/building-linking-info';

export default async function AdminBuildingsPage() {
  await requireUser();

  // Only the data load is guarded: rendering happens outside try, so errors in the JSX are not swallowed here.
  let linkedBuildings: Awaited<ReturnType<typeof getLinkedBuildings>>;
  try {
    linkedBuildings = await getLinkedBuildings();
  } catch (error) {
    console.error('Error loading linked buildings:', error);
    redirect('/workspace');
  }
  const activeBuildings = linkedBuildings.filter((b) => b.status === 'active');
  const pendingBuildings = linkedBuildings.filter((b) => b.status === 'pending');

  return (
    <div className="admin-section">
      <PageHeading
        title="Linked Buildings"
        description="Manage building links and firm access. Buildings invite your firm, you accept the link."
      />

      <div className="space-y-8">
        <BuildingLinkingInfo />

        <section>
          <h2>Active Links ({activeBuildings.length})</h2>
          <LinkedBuildingsTable buildings={activeBuildings} />
        </section>

        {pendingBuildings.length > 0 && (
          <section>
            <h2>Pending Acceptance ({pendingBuildings.length})</h2>
            <LinkedBuildingsTable buildings={pendingBuildings} />
          </section>
        )}
      </div>

      <style>{`
          .admin-section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .space-y-8 > * + * {
            margin-top: 2rem;
          }
        `}</style>
    </div>
  );
}
