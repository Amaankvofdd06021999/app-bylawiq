import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ResidentManagement } from '@/features/residents/components/resident-management';
import { Shell } from '@/components/shell';
import { openBuilding } from '@/app/_screens/guard';
import { supabaseSource } from '@/data/supabase';

interface Props {
  params: Promise<{ buildingId: string }>;
}

export default async function ResidentsPage({ params }: Props) {
  const { buildingId } = await params;
  const user = await requireUser();

  const db = await createClient();

  // Get building info
  const { data: building } = await db.from('buildings').select('id, name').eq('id', buildingId).single();

  if (!building) {
    redirect('/');
  }

  // Verify user is building manager
  // Permission-gated (decision D1): the page is for staff who hold member.read in this building.
  const allowed = await user.client.rpc('authorize', { p_permission: 'member.read', p_building: buildingId });
  if (allowed.data !== true) {
    redirect('/');
  }

  const source = supabaseSource();
  const state = await openBuilding(source, buildingId);

  return (
    <Shell
      profile={state.profile}
      buildings={state.buildings}
      activeId={buildingId}
      permissions={state.permissions}
      unreadUpdates={state.unreadUpdates}
      {...state.nav}
    >
      <div className="page-container">
        <div className="page-header">
          <h1>Residents</h1>
          <p className="subtitle">{building.name}</p>
        </div>

        <ResidentManagement buildingId={buildingId} buildingName={building.name} />

        <style>{`
          .page-container {
            max-width: 1200px;
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
    </Shell>
  );
}
