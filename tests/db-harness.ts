import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { readFile, readdir } from 'node:fs/promises';
// Minimal stand-ins for the Supabase roles and schemas the migrations expect.
const SUPABASE_STUBS = `create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage,public to authenticated,anon,service_role,supabase_auth_admin;
 grant execute on function auth.uid() to authenticated,anon,service_role,supabase_auth_admin;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
 grant select,insert on storage.objects to authenticated;`;
export const uid = (n: number) => '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
export async function migratedDb() {
  const db = new PGlite({ extensions: { vector, pgcrypto, pg_trgm } });
  const sql = (s: string) => db.exec(s);
  await sql(SUPABASE_STUBS);
  for (const file of (await readdir('supabase/migrations')).filter((f) => f.endsWith('.sql')).sort())
    await sql(await readFile('supabase/migrations/' + file, 'utf8'));
  const identity = async (id: string) => {
    await sql(
      "reset role; select set_config('request.jwt.claim.sub','" + id + "',false); set role authenticated;",
    );
  };
  const admin = async () => {
    await sql('reset role;');
  };
  const rows = async <T>(q: string, p?: unknown[]) => (await db.query<T>(q, p)).rows;
  return { db, sql, identity, admin, rows };
}
export type TestDb = Awaited<ReturnType<typeof migratedDb>>;
export async function addUsers(t: TestDb, ...ids: string[]) {
  await t.admin();
  await t.sql(
    `insert into auth.users(id,email,email_confirmed_at) values ${ids.map((id) => `('${id}','${id.slice(-4)}@example.test',now())`).join(',')};`,
  );
}
