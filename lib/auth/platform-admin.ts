import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { ForbiddenError, checkDb } from '@/lib/errors';

/** Platform admin status comes from the database (platform_admins, via is_platform_admin, which also needs an aal2 session). It never comes from user_metadata, which users can edit. */
export async function requirePlatformAdmin(user: SessionUser, message: string): Promise<void> {
  const { data, error } = await user.client.rpc('is_platform_admin');
  checkDb(error);
  if (data !== true) throw new ForbiddenError(message);
}
