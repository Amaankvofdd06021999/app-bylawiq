import { demoSource } from '@/mock/data-source';
import { BuildingSectionScreen } from '@/app/_screens/building-section';
export const dynamic = 'force-dynamic';
export default async function DemoBuildingPage(props: {
  params: Promise<{ buildingId: string; section: string }>;
  searchParams: Promise<{ agent?: string; scope?: string; tab?: string; collection?: string }>;
}) {
  return BuildingSectionScreen({ source: await demoSource(), ...props });
}
