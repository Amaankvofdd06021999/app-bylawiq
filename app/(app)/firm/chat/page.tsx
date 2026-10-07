import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { MultiRoleChat } from '@/features/chat/components/multi-role-chat';

export default async function FirmChatPage() {
  const user = await requireUser();
  const db = await createClient();

  // Verify user is a firm owner
  const { data: org } = await db
    .from('organizations')
    .select('id, name')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (!org) {
    redirect('/');
  }

  // Get all buildings in this org
  const { data: buildings } = await db
    .from('buildings')
    .select('id')
    .eq('organization_id', org.id)
    .is('deleted_at', null);

  const buildingIds = buildings?.map((b) => b.id) || [];

  return (
    <div className="firm-chat-container">
      <div className="chat-header">
        <h1>Firm Management Chat</h1>
        <p className="subtitle">Get insights across your organization ({buildingIds.length} buildings)</p>
      </div>

      <MultiRoleChat
        role="firm_owner"
        buildingIds={buildingIds}
        title={`${org.name} - Firm Chat`}
        showSources={true}
      />

      <style jsx>{`
        .firm-chat-container {
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
          .firm-chat-container {
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
