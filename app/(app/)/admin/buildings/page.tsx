import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getLinkedBuildings } from '@/features/admin/linked-buildings-queries';
import { LinkedBuildingsTable } from '@/features/admin/components/linked-buildings-table';
import { BuildingLinkingInfo } from '@/features/admin/components/building-linking-info';

export default async function AdminBuildingsPage() {
  const user = await requireUser();

  try {
    const linkedBuildings = await getLinkedBuildings();
    const activeBuildings = linkedBuildings.filter((b) => b.status === 'active');
    const pendingBuildings = linkedBuildings.filter((b) => b.status === 'pending');

    return (
      <div className="admin-section">
        <PageHeading
          title="Linked Buildings"
          description="Manage building links and firm access."
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
      </div>
    );
  } catch (error) {
    console.error('Error loading linked buildings:', error);
    redirect('/workspace');
  }
}
