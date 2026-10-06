import { notFound, redirect } from 'next/navigation';
import type { DataSource } from '@/data/source';
import { PlatformAdminDashboard, PlatformFrame } from '@/features/dashboards/components/platform-admin';
import { orSignIn } from './guard';

// The BylawIQ platform admin's console (`/admin`, `/demo/admin`): aggregates across every customer, outside any
// building, and never a building's documents. Anyone else is sent to their own home. A data source without the
// console yet (the real app) is a 404.
export async function PlatformAdminScreen({ source }: { source: DataSource }) {
  if (!(await orSignIn(source, source.isPlatformAdmin()))) {
    const landing = await orSignIn(source, source.landingPath());
    redirect(landing);
  }
  const overview = await source.platformDashboard();
  if (!overview) notFound();
  return (
    <PlatformFrame name={overview.name}>
      <PlatformAdminDashboard data={overview.data} />
    </PlatformFrame>
  );
}
