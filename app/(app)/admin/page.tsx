import { supabaseSource } from '@/data/supabase';
import { PlatformAdminScreen } from '@/app/_screens/platform-admin';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platform overview' };
export default async function AdminPage() {
  return PlatformAdminScreen({ source: supabaseSource() });
}
