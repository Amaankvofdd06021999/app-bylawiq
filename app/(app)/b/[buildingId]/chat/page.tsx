import { redirect } from 'next/navigation';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { MultiRoleChat } from '@/features/chat/components/multi-role-chat';
import { getUserChatContext } from '@/features/chat/multi-role-chats';

export default async function BuildingChatPage({
  params,
}: {
  params: Promise<{ buildingId: string }>;
}) {
  const user = await requireUser();
  const { buildingId } = await params;

  await requirePermission(user, 'chat.use', buildingId);

  const db = await createClient();

  // Get building details
  const { data: building } = await db
    .from('buildings')
    .select('id, name, city')
    .eq('id', buildingId)
    .single();

  if (!building) {
    redirect('/');
  }

  // Get user's role in this building
  const { data: member } = await db
    .from('building_members')
    .select('role')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .maybeSingle();

  // Determine role
  let role: 'resident' | 'building_manager' = 'resident';
  if (member?.role === 'building_manager') {
    role = 'building_manager';
  }

  return (
    <div className="chat-page-container">
      <div className="chat-header">
        <h1>{building.name}</h1>
        {building.city && <p className="location">{building.city}</p>}
      </div>

      <MultiRoleChat
        role={role}
        buildingId={buildingId}
        buildingName={building.name}
        title={role === 'building_manager' ? 'Building Management Chat' : 'Building Chat'}
        showSources={true}
      />

      <style jsx>{`
        .chat-page-container {
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

        .location {
          margin: 0.5rem 0 0 0;
          color: #666;
          font-size: 0.95rem;
        }

        @media (max-width: 768px) {
          .chat-page-container {
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
