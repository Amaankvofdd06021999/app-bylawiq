import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { MultiRoleChat } from '@/features/chat/components/multi-role-chat';

export default async function PortfolioChatPage() {
  const user = await requireUser();
  const db = await createClient();

  // Verify user is a strata manager
  const { data: assignments } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  if (!assignments || assignments.length === 0) {
    redirect('/');
  }

  const buildingIds = assignments.map((a) => a.building_id);

  // Get building count for title
  const { data: buildings } = await db
    .from('buildings')
    .select('id')
    .in('id', buildingIds);

  return (
    <div className="portfolio-chat-container">
      <div className="chat-header">
        <h1>Portfolio Management Chat</h1>
        <p className="subtitle">Ask questions across your {buildings?.length || 0} buildings</p>
      </div>

      <MultiRoleChat
        role="strata_manager"
        buildingIds={buildingIds}
        title={`Strata Manager Chat (${buildingIds.length} buildings)`}
        showSources={true}
      />

      <style jsx>{`
        .portfolio-chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          gap: 1.5rem;
          padding: 2rem 1rem;
          background: #f9fafb;
        }

        .chat-header {
          flex-shrink: 0;
        }

        .chat-header h1 {
          margin: 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .subtitle {
          margin: 0.5rem 0 0 0;
          color: #666;
          font-size: 0.95rem;
        }

        @media (max-width: 768px) {
          .portfolio-chat-container {
            padding: 1rem;
          }

          .chat-header h1 {
            font-size: 1.5rem;
          }
        }
      `}</style>
    </div>
  );
}
