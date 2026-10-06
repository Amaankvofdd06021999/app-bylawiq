import { supabaseSource } from '@/data/supabase';
import { WorkspaceScreen } from '@/app/_screens/workspace';
export const dynamic = 'force-dynamic';
export default async function WorkspacePage(props: {
  searchParams: Promise<{ notice?: string; code?: string }>;
}) {
  return WorkspaceScreen({ source: supabaseSource(), ...props });
}
