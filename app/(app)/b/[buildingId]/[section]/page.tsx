import { supabaseSource } from '@/data/supabase';
import { BuildingSectionScreen } from '@/app/_screens/building-section';
export const dynamic = 'force-dynamic';
export default async function BuildingPage(props: {
  params: Promise<{ buildingId: string; section: string }>;
  searchParams: Promise<{ agent?: string; scope?: string; tab?: string; collection?: string }>;
}) {
  return BuildingSectionScreen({ source: supabaseSource(), ...props });
}
