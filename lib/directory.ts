import 'server-only';
import { z } from 'zod';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';

const DirectoryRow = z.object({
  user_id: z.uuid(),
  email: z.string(),
  display_name: z.string().nullable(),
});

export type DirectoryEntry = { email: string; displayName: string | null };

/** Emails and display names for the given people, limited by the directory_emails policy to people the caller can see. */
export async function directoryFor(
  user: SessionUser,
  userIds: string[],
): Promise<Map<string, DirectoryEntry>> {
  const ids = [...new Set(userIds)];
  const entries = new Map<string, DirectoryEntry>();
  if (!ids.length) return entries;
  const { data, error } = await user.client.rpc('directory_emails', { p_user_ids: ids });
  checkDb(error);
  for (const row of z.array(DirectoryRow).parse(data ?? [])) {
    entries.set(row.user_id, { email: row.email, displayName: row.display_name });
  }
  return entries;
}
