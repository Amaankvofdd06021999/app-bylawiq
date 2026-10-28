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
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error('SUPABASE_DB_URL missing');

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to PostgreSQL');

  const migrationsDir = path.resolve(__dirname, '../supabase/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const versions = [];
  for (const file of files) {
    const match = file.match(/^(\d+)/);
    if (match) {
      versions.push({ version: match[1], file });
    }
  }

  const { rows } = await client.query('select version from supabase_migrations.schema_migrations;');
  const existing = new Set(rows.map((r) => r.version));

  let insertedCount = 0;
  for (const item of versions) {
    if (!existing.has(item.version)) {
      await client.query(
        'insert into supabase_migrations.schema_migrations (version) values ($1) on conflict do nothing;',
        [item.version],
      );
      console.log(`Synced migration version: ${item.version} (${item.file})`);
      insertedCount++;
    }
  }

  console.log(`Sync complete! Inserted ${insertedCount} missing migration versions.`);

  const finalCheck = await client.query(
    'select version from supabase_migrations.schema_migrations order by version desc limit 15;',
  );
  console.log(
    'Top 15 latest migrations in ledger:',
    finalCheck.rows.map((r) => r.version),
  );

  await client.end();
}

run();
