import { notFound } from 'next/navigation';
import type { DataSource } from '@/data/source';
import { NotFoundError } from '@/lib/errors';
import { Shell } from '@/components/shell';
import { Conversation } from '@/features/chat/components/chat-ui';
import { openBuilding, orSignIn } from './guard';

// One conversation (`/b/<id>/chat/<chatId>`, `/demo/b/<id>/chat/<chatId>`). A chat that isn't the person's own,
// or belongs to another building, is a 404 — never a hint that it exists (AGENTS.md §0).
export async function ChatScreen({
  source,
  params,
  searchParams,
}: {
  source: DataSource;
  params: Promise<{ buildingId: string; chatId: string }>;
  searchParams: Promise<{ layers?: string }>;
}) {
  const { buildingId, chatId } = await params;
  const state = await openBuilding(source, buildingId);
  const { chat, messages } = await orSignIn(source, source.conversation(chatId)).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  if (chat.building_id && chat.building_id !== buildingId) notFound();
  const available = chat.building_id ? await source.layers(buildingId) : undefined;
  const requested = String((await searchParams).layers || '').split(',');
  return (
    <Shell
      profile={state.profile}
      buildings={state.buildings}
      activeId={buildingId}
      permissions={state.permissions}
      unreadUpdates={state.unreadUpdates}
      {...state.nav}
    >
      <Conversation
        id={chat.id}
        building={state.building}
        buildings={state.buildings}
        scope={chat.scope}
        asOf={chat.as_of}
        initialMessages={messages}
        availableLayers={available}
        canDraft={state.permissions.includes('document.draft')}
        initialLayers={available?.filter((l) => requested.includes(l))}
      />
    </Shell>
  );
}
