import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ResidentManagement } from '@/features/residents/components/resident-management';

interface Props {
  params: Promise<{ buildingId: string }>;
}

export default async function ResidentsPage({ params }: Props) {
  const { buildingId } = await params;
  const user = await requireUser();

  const db = await createClient();

  // Get building info
  const { data: building } = await db
    .from('buildings')
    .select('id, name')
    .eq('id', buildingId)
    .single();

  if (!building) {
    redirect('/');
  }

  // Verify user is building manager
  const { data: member } = await db
    .from('building_members')
    .select('role')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .single();

  if (!member || member.role !== 'building_manager') {
    redirect('/');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Residents</h1>
        <p className="subtitle">{building.name}</p>
      </div>

      <ResidentManagement buildingId={buildingId} buildingName={building.name} />

      <style jsx>{`
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
  );
}
