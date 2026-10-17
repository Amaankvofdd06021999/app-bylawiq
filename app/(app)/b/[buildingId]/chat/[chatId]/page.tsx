import { notFound } from 'next/navigation';
import { supabaseSource } from '@/data/supabase';
import { ChatScreen } from '@/app/_screens/chat';
import { launchFeatureEnabled } from '@/lib/launch-scope';
export const dynamic = 'force-dynamic';
export default async function ChatPage(props: {
  params: Promise<{ buildingId: string; chatId: string }>;
  searchParams: Promise<{ layers?: string }>;
}) {
  // Conversations are off for this release. The page does not load the chat (lib/launch-scope.ts).
  if (!launchFeatureEnabled('answers')) notFound();
  return ChatScreen({ source: supabaseSource(), ...props });
}
