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
  const { rows } = await c.query(
    'select count(*), quarantined_status, reason from public.legal_sources_quarantine_log group by quarantined_status, reason;',
  );
  console.log('Quarantine log snapshot:', rows);
  await c.end();
})();
