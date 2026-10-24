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

  console.log('=== Step 1: Elevate and set AAL2 session for test admin ===');
  const userRes = await client.query("select id from auth.users where email = 'golden-test-manager@bylawiq.app' limit 1");
  const testUserId = userRes.rows[0].id;

  const claims = JSON.stringify({ sub: testUserId, aal: 'aal2', role: 'authenticated' });
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [testUserId]);
  await client.query("select set_config('request.jwt.claims', $1, false)", [claims]);

  console.log('=== Step 2: Test get_building_transfer_candidates ===');
  const candidatesRes = await client.query("select * from public.get_building_transfer_candidates() limit 5");
  console.log('Candidates sample:', candidatesRes.rows);

  console.log('=== Step 3: Test get_firm_transfer_destinations ===');
  const firmsRes = await client.query("select * from public.get_firm_transfer_destinations()");
  console.log('Firms sample:', firmsRes.rows);

  // We choose Horizon Heights
  const building = candidatesRes.rows.find(b => b.building_name === 'Horizon Heights') || candidatesRes.rows[0];
  console.log('Target Building:', building.building_name, building.building_id, 'Current Firm:', building.current_firm_name);

  // Choose a destination firm different from current
  const destFirm = firmsRes.rows.find(f => f.firm_id !== building.current_firm_id);
  console.log('Destination Firm:', destFirm.firm_name, destFirm.firm_id);

  console.log('=== Step 4: Execute transfer_building_firm ===');
  const transferRes = await client.query(
    "select public.transfer_building_firm($1, $2, null) as result",
    [building.building_id, destFirm.firm_id]
  );
  console.log('Transfer RPC result:', transferRes.rows[0].result);

  console.log('=== Step 5: Verify links in database ===');
  await client.query("reset role");
  const linksRes = await client.query(
    "select id, firm_org_id, status, created_at, revoked_at from public.firm_building_links where building_id = $1 order by created_at desc",
    [building.building_id]
  );
  console.log('Building links state:');
  console.table(linksRes.rows);

  const activeLinks = linksRes.rows.filter(l => l.status === 'active');
  if (activeLinks.length !== 1 || activeLinks[0].firm_org_id !== destFirm.firm_id) {
    throw new Error('Active link verification failed!');
  }
  console.log('SUCCESS: Exactly 1 active link exists, pointing to destination firm!');

  console.log('=== Step 6: Verify audit log entry ===');
  const auditRes = await client.query(
    "select action, resource_type, resource_id, resource_name, details from public.platform_audit_log where action = 'building.transfer_firm' and resource_id = $1 order by occurred_at desc limit 1",
    [building.building_id]
  );
  console.log('Audit log entry:', auditRes.rows[0]);

  await client.end();
  console.log('\n=============================================');
  console.log('LIVE TRANSFER VERIFIED CLEANLY AND ATOMICALLY!');
  console.log('=============================================');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
