/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

async function run() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const firms = await client.query(`
    select id, name, kind from public.organizations where kind = 'firm' limit 10;
  `);
  console.log('Existing firms:', firms.rows);

  const buildings = await client.query(`
    select b.id, b.name, l.firm_org_id, o.name as firm_name
    from public.buildings b
    left join public.firm_building_links l on l.building_id = b.id and l.status = 'active'
    left join public.organizations o on o.id = l.firm_org_id
    limit 10;
  `);
  console.log('Existing buildings:', buildings.rows);

  await client.end();
}

run();
