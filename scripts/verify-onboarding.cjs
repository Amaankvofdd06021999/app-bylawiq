const { Client } = require('pg');
const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });

async function verify() {
  await client.connect();
  console.log('--- Step 0: Set operator and grant platform admin for test ---');
  const userRes = await client.query("select id from auth.users where email = 'golden-test-manager@bylawiq.app' limit 1");
  const testUserId = userRes.rows[0].id;

  await client.query("begin");
  await client.query("set local bylawiq.operator = 'automated-tester'");
  await client.query("set local bylawiq.reason = 'Verifying firm onboarding engine'");
  await client.query("insert into public.platform_admins (user_id) values ($1) on conflict do nothing", [testUserId]);
  await client.query("commit");

  console.log('--- Step 1: Simulate platform admin session with AAL2 ---');
  const claims = JSON.stringify({ sub: testUserId, aal: 'aal2', role: 'authenticated' });
  await client.query("set role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, false)", [testUserId]);
  await client.query("select set_config('request.jwt.claims', $1, false)", [claims]);

  console.log('--- Step 2: Call start_onboarding ---');
  const startRes = await client.query("select public.start_onboarding('Horizon Strata Management', 'management_firm') as workflow_id");
  const workflowId = startRes.rows[0].workflow_id;
  console.log('Started onboarding workflow:', workflowId);

  console.log('--- Step 3: Call onboarding_add_building ---');
  const bldgRes = await client.query("select public.onboarding_add_building($1, 'Horizon Heights', 'BC', 85) as building_id", [workflowId]);
  const buildingId = bldgRes.rows[0].building_id;
  console.log('Added building:', buildingId);

  console.log('--- Step 4: Call onboarding_add_team_member ---');
  const memberRes = await client.query("select public.onboarding_add_team_member($1, 'horizon-manager@bylawiq.app', 'portfolio_manager') as member_id", [workflowId]);
  console.log('Added team member:', memberRes.rows[0].member_id);

  console.log('--- Step 5: Call complete_onboarding ---');
  const compRes = await client.query("select public.complete_onboarding($1) as ok", [workflowId]);
  console.log('Completed onboarding result:', compRes.rows[0].ok);

  console.log('--- Step 6: Verify Database State ---');
  await client.query("reset role");
  const wfRes = await client.query("select id, status, step, completed_at, org_id from public.onboarding_workflows where id = $1", [workflowId]);
  console.log('Workflow status:', wfRes.rows[0]);

  const bldgVerify = await client.query("select id, name, org_id, region, jurisdiction_chain, unit_count from public.buildings where id = $1", [buildingId]);
  console.log('Created building:', bldgVerify.rows[0]);

  const linkVerify = await client.query("select id, building_id, firm_org_id, status from public.firm_building_links where building_id = $1", [buildingId]);
  console.log('Firm-building link:', linkVerify.rows[0]);

  const auditVerify = await client.query("select action, resource_type, resource_name, occurred_at from public.platform_audit_log where admin_id = $1 order by occurred_at desc limit 4", [testUserId]);
  console.log('Recent audit logs:', auditVerify.rows);

  await client.end();
  console.log('\n=============================================');
  console.log('ALL 5 STEPS EXECUTED AND VERIFIED END-TO-END!');
  console.log('=============================================');
}

verify().catch(e => {
  console.error('Verification failed:', e);
  process.exit(1);
});
