/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const { Client } = require('pg');

const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
let dbUrl = '';
for (const l of lines) {
  if (l.startsWith('SUPABASE_DB_URL='))
    dbUrl = l
      .split('=')[1]
      .trim()
      .replace(/^["']|["']$/g, '');
}

(async () => {
  const c = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const { rows: pols } = await c.query(
    "select policyname, qual from pg_policies where tablename = 'legal_sources_quarantine_log';",
  );
  console.log('Quarantine log policies:', pols);
  const { rows: constrs } = await c.query(
    "select conname, contype from pg_constraint where conrelid = 'public.legal_sources_quarantine_log'::regclass;",
  );
  console.log('Constraints:', constrs);
  await c.end();
})();
