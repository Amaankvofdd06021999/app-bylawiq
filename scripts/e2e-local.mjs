#!/usr/bin/env node
// Runs the end-to-end suite against the LOCAL Supabase stack only:
//   1. reads the local stack's URL and keys from `supabase status` (values stay in memory, never printed),
//   2. builds the production app with those values,
//   3. runs Playwright on the dedicated test port (playwright.config.ts refuses anything else).
// Usage: npm run test:e2e:local -- [playwright args]

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const run = (command, args, env) =>
  spawnSync(command, args, { stdio: 'inherit', shell: true, env: { ...process.env, ...env } });

const status = spawnSync('npx', ['--yes', 'supabase@2.102.0', 'status', '-o', 'env'], {
  shell: true,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});
const values = {};
for (const line of (status.stdout ?? '').split(/\r?\n/)) {
  const match = line.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (match) values[match[1]] = match[2];
}
if (!values.API_URL || !values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
  console.error(
    'The local Supabase stack is not running (or its keys are unavailable). Start it with `supabase start`.',
  );
  process.exit(1);
}

// The database verifies trusted assistant messages with the key in private.runtime_secrets, and the app signs them with
// SERVER_SIGNING_SECRET. They must be the same value, so this run generates one, writes it to the local database and
// passes the same value to the app. Hosted environments need the same provisioning, set by an operator.
const signingSecret = randomBytes(32).toString('hex');
const provisioned = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_bylawiq',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
  ],
  {
    input: `update private.runtime_secrets set value = '${signingSecret}' where name = 'server_signing';`,
    stdio: ['pipe', 'ignore', 'pipe'],
  },
);
if (provisioned.status !== 0) {
  console.error('Could not provision the local signing key in the database. Is the local stack running?');
  process.exit(1);
}

const scanToken = randomBytes(24).toString('base64url');
const local = {
  FILE_SCAN_TOKEN: scanToken,
  LOCAL_SCANNER_PORT: process.env.LOCAL_SCANNER_PORT ?? '8790',
  SERVER_SIGNING_SECRET: signingSecret,
  NEXT_PUBLIC_SUPABASE_URL: values.API_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: values.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: values.SERVICE_ROLE_KEY,
  SUPABASE_DB_URL: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${process.env.E2E_PORT ?? '3100'}`,
  E2E_PORT: process.env.E2E_PORT ?? '3100',
  DEMO_MODE: 'on',
};
console.log(`Using local Supabase at ${values.API_URL}. Variables set: ${Object.keys(local).join(', ')}`);

const build = run('npm', ['run', 'build'], local);
if (build.status !== 0) process.exit(build.status ?? 1);

const playwright = run('npx', ['playwright', 'test', ...process.argv.slice(2)], local);
process.exit(playwright.status ?? 1);
