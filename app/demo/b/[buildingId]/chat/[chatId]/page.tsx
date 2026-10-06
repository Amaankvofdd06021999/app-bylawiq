import { demoSource } from '@/mock/data-source';
import { ChatScreen } from '@/app/_screens/chat';
export const dynamic = 'force-dynamic';
export default async function DemoChatPage(props: {
  params: Promise<{ buildingId: string; chatId: string }>;
  searchParams: Promise<{ layers?: string }>;
}) {
  return ChatScreen({ source: await demoSource(), ...props });
}
