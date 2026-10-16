import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { assertLocalSupabase } from './local-mfa';

/**
 * Seeds two building managers, each owning their own firm and building, through the real bootstrap function. Local
 * stack only (assertLocalSupabase). Names are run-unique, so reruns never share data.
 */

export type SliceAccount = {
  id: string;
  email: string;
  password: string;
  buildingId: string;
  buildingName: string;
};

const CONTAINER = 'supabase_db_bylawiq';

function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'],
    { input: sql, encoding: 'utf8' },
  ).trim();
}

async function createUser(url: string, email: string, password: string): Promise<string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!res.ok) throw new Error(`Creating a local test user failed with status ${res.status}`);
  const body = (await res.json()) as { id?: unknown };
  if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/.test(body.id))
    throw new Error('Unexpected user id shape');
  return body.id;
}

async function seedManager(label: string): Promise<SliceAccount> {
  const url = assertLocalSupabase();
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const email = `e2e-${label}-${stamp}@example.invalid`;
  const password = `E2e-${randomBytes(12).toString('base64url')}-1`;
  const id = await createUser(url, email, password);
  const buildingName = `E2E building ${label} ${stamp}`;
  // The bootstrap reads auth.uid() from the session claim, so the call is made as this user.
  const buildingId = psql(`
set request.jwt.claim.sub = '${id}';
select public.bootstrap_workspace('E2E firm ${label} ${stamp}', 'admin', '${buildingName}', 'Manager ${label}');
select id from public.buildings where name = '${buildingName}';
`)
    .split('\n')
    .pop()!
    .trim();
  if (!/^[0-9a-f-]{36}$/.test(buildingId)) throw new Error('Bootstrap did not return a building id');
  return { id, email, password, buildingId, buildingName };
}

export async function seedSliceManagers(): Promise<{ managerA: SliceAccount; managerB: SliceAccount }> {
  const managerA = await seedManager('a');
  const managerB = await seedManager('b');
  return { managerA, managerB };
}

/** Reads a document's status as the local database records it. Used only to wait for indexing, not for assertions of access. */
export function documentStatus(documentTitle: string, buildingId: string): string {
  return psql(
    `select status from public.documents where building_id = '${buildingId}' and title = '${documentTitle}' and deleted_at is null order by created_at desc limit 1;`,
  );
}

/** The error the pipeline recorded for a document, read from the local database to check the failure message. */
export function documentError(documentTitle: string, buildingId: string): string {
  return psql(
    `select coalesce(error_message, '') from public.documents where building_id = '${buildingId}' and title = '${documentTitle}' and deleted_at is null order by created_at desc limit 1;`,
  );
}

/** The id of the newest document with this title in a building, from the local database. */
export function documentId(documentTitle: string, buildingId: string): string {
  return psql(
    `select id from public.documents where building_id = '${buildingId}' and title = '${documentTitle}' and deleted_at is null order by created_at desc limit 1;`,
  );
}
