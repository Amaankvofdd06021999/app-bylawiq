#!/usr/bin/env node
// Checks which environment variables a Vercel environment defines, by NAME only.
// `vercel env ls` prints names without values; this script never requests or prints a value.
//
// Usage: node scripts/check-vercel-env.mjs [production|preview|development]
// Needs the Vercel CLI, logged in and linked to the project (`vercel link`). It is not run in CI.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const environment = process.argv[2] ?? 'production';
if (!['production', 'preview', 'development'].includes(environment)) {
  console.error('Environment must be production, preview or development.');
  process.exit(2);
}

const groups = JSON.parse(readFileSync(new URL('../lib/env-groups.json', import.meta.url), 'utf8'));

const listing = spawnSync('vercel', ['env', 'ls', environment], { shell: true, encoding: 'utf8' });
if (listing.error || listing.status !== 0) {
  console.error(
    'Could not list Vercel variables. Install the Vercel CLI, run `vercel login` and `vercel link`, then retry.',
  );
  process.exit(2);
}

// Names are the first column of each table row that looks like an env var name.
const defined = new Set(
  listing.stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((token) => /^[A-Z][A-Z0-9_]+$/.test(token)),
);

console.log(`Vercel ${environment}: variable presence by name (values are never shown).`);
for (const [group, names] of Object.entries(groups)) {
  const missing = names.filter((name) => !defined.has(name));
  const state = missing.length === 0 ? 'complete' : `missing ${missing.join(', ')}`;
  console.log(`  ${group.padEnd(10)} ${state}`);
}

// Production cannot run without the core group. Other groups only switch their feature off when absent.
const coreMissing = groups.core.filter((name) => !defined.has(name));
process.exit(environment === 'production' && coreMissing.length > 0 ? 1 : 0);
