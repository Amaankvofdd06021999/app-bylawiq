import { redirect } from 'next/navigation';

export default async function ChatRedirect({ params }: { params: Promise<{ buildingId: string }> }) {
  const { buildingId } = await params;
  redirect(`/b/${buildingId}/ask`);
}
