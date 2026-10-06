import { supabaseSource } from '@/data/supabase';
import { ChatScreen } from '@/app/_screens/chat';
export const dynamic = 'force-dynamic';
export default async function ChatPage(props: {
  params: Promise<{ buildingId: string; chatId: string }>;
  searchParams: Promise<{ layers?: string }>;
}) {
  return ChatScreen({ source: supabaseSource(), ...props });
}
