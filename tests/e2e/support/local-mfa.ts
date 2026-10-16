import { createHmac, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

/**
 * Local-only helpers for the platform MFA end-to-end tests. Every helper refuses to run unless the Supabase URL is the
 * local stack, so these tests cannot create accounts or grants in a hosted project.
 */

const LOCAL_DB_CONTAINER = 'supabase_db_bylawiq';

export type SeededAccount = { id: string; email: string; password: string };

export function assertLocalSupabase(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  if (!/^http:\/\/(127\.0\.0\.1|localhost):54321\/?$/.test(url)) {
    throw new Error(
      'Platform MFA e2e tests run only against the local Supabase stack (http://127.0.0.1:54321).',
    );
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    throw new Error('SUPABASE_SERVICE_ROLE_KEY must be set from `supabase status` for the local stack.');
  return url.replace(/\/$/, '');
}

function runSql(sql: string) {
  execFileSync(
    'docker',
    [
      'exec',
      '-i',
      LOCAL_DB_CONTAINER,
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-q',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    { input: sql, stdio: ['pipe', 'ignore', 'pipe'] },
  );
}

async function createAuthUser(url: string, email: string, password: string): Promise<string> {
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

/**
 * Creates one platform admin and one ordinary user, with run-unique emails, so reruns never collide. The admin is
 * granted through the operator-and-reason path that migration 50 requires.
 */
export async function seedMfaAccounts(): Promise<{ admin: SeededAccount; ordinary: SeededAccount }> {
  const url = assertLocalSupabase();
  const stamp = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const password = `E2e-${randomBytes(12).toString('base64url')}-1`;
  const admin = { email: `e2e-admin-${stamp}@example.invalid`, password, id: '' };
  const ordinary = { email: `e2e-ordinary-${stamp}@example.invalid`, password, id: '' };
  admin.id = await createAuthUser(url, admin.email, admin.password);
  ordinary.id = await createAuthUser(url, ordinary.email, ordinary.password);

  runSql(`
begin;
set local bylawiq.operator = 'e2e-seed';
set local bylawiq.reason = 'E2E fixture for the platform MFA tests';
insert into public.platform_admins (user_id) values ('${admin.id}');
commit;
`);
  return { admin, ordinary };
}

/** RFC 6238 TOTP code (SHA-1, 6 digits, 30-second step) for a base32 secret. */
export function totpAt(secretBase32: string, atMs: number = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const ch of secretBase32.replace(/=+$/, '').toUpperCase()) {
    const value = alphabet.indexOf(ch);
    if (value < 0) throw new Error('Secret is not base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((b) => parseInt(b, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(atMs / 30_000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

/** Milliseconds until the next 30-second TOTP step, so a second code is never one the server has already used. */
export function msUntilNextTotpStep(atMs: number = Date.now()): number {
  return 30_000 - (atMs % 30_000) + 500;
}
