import { redirect } from 'next/navigation';
import { NotFoundError, UnauthorizedError } from '@/lib/errors';
import type { BuildingWorkspaceData, DataSource } from '@/data/source';

/** Awaits a read, sending someone who isn't signed in to the source's sign-in page. */
export async function orSignIn<T>(source: DataSource, read: Promise<T>): Promise<T> {
  try {
    return await read;
  } catch (e) {
    if (e instanceof UnauthorizedError) redirect(source.signInPath);
    throw e;
  }
}

/** Loads a building the person may open. One they can't — removed, or never theirs — sends them back to the
 * overview with a notice that says so without confirming the building exists. The platform admin, who has no
 * buildings, goes to their own console. */
export async function openBuilding(source: DataSource, buildingId: string): Promise<BuildingWorkspaceData> {
  if (await orSignIn(source, source.isPlatformAdmin())) redirect(source.base + '/admin');
  try {
    return await orSignIn(source, source.buildingWorkspace(buildingId));
  } catch (e) {
    if (e instanceof NotFoundError) redirect(source.base + '/workspace?notice=access_removed');
    throw e;
  }
}
