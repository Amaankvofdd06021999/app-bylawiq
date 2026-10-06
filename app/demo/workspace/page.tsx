import { demoSource } from '@/mock/data-source';
import { WorkspaceScreen } from '@/app/_screens/workspace';
export const dynamic = 'force-dynamic';
export default async function DemoWorkspacePage(props: {
  searchParams: Promise<{ notice?: string; code?: string }>;
}) {
  return WorkspaceScreen({ source: await demoSource(), ...props });
}
