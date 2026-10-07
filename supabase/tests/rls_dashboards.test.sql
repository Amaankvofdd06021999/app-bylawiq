-- supabase/tests/rls_dashboards.test.sql
-- pgTAP tests for dashboard RLS isolation
-- Ensures firm owner dashboards cannot leak cross-org data

begin;
  select plan(6);

  -- Setup: Create two orgs with different owners
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    ('alice-id'::uuid, 'alice@test.local', crypt('password', gen_salt('bf')), now(), now(), now()),
    ('bob-id'::uuid, 'bob@test.local', crypt('password', gen_salt('bf')), now(), now(), now());

  insert into public.profiles (id, display_name, account_type, created_at)
  values
    ('alice-id'::uuid, 'Alice Owner', 'admin', now()),
    ('bob-id'::uuid, 'Bob Owner', 'admin', now());

  insert into public.organizations (id, name, created_by, kind, created_at)
  values
    ('org-a'::uuid, 'Firm A', 'alice-id'::uuid, 'firm', now()),
    ('org-b'::uuid, 'Firm B', 'bob-id'::uuid, 'firm', now());

  insert into public.org_members (id, org_id, user_id, role, status)
  values
    ('org-a-alice'::uuid, 'org-a'::uuid, 'alice-id'::uuid, 'org_owner'::app_role, 'active'),
    ('org-b-bob'::uuid, 'org-b'::uuid, 'bob-id'::uuid, 'org_owner'::app_role, 'active');

  -- Create buildings for each org
  insert into public.buildings (id, org_id, name, address, municipality, created_at)
  values
    ('building-a1'::uuid, 'org-a'::uuid, 'Building A1', '123 Main', 'Vancouver', now()),
    ('building-b1'::uuid, 'org-b'::uuid, 'Building B1', '456 Oak', 'Victoria', now());

  -- Add managers to each building
  insert into public.building_members (id, building_id, user_id, role, status)
  values
    ('bm-a1-alice'::uuid, 'building-a1'::uuid, 'alice-id'::uuid, 'building_manager'::app_role, 'active'),
    ('bm-b1-bob'::uuid, 'building-b1'::uuid, 'bob-id'::uuid, 'building_manager'::app_role, 'active');

  -- TEST 1: Firm owner A can read only org A buildings
  set request.jwt.claims = json_build_object(
    'sub', 'alice-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'org-a'::text
  )::text;

  select is(
    (select count(*) from public.buildings where org_id = 'org-a'::uuid),
    1::bigint,
    'Firm A owner sees Firm A building'
  );

  -- TEST 2: Firm owner A cannot read org B buildings
  select is(
    (select count(*) from public.buildings where org_id = 'org-b'::uuid),
    0::bigint,
    'Firm A owner cannot see Firm B buildings'
  );

  -- TEST 3: Firm owner B can read only org B buildings
  set request.jwt.claims = json_build_object(
    'sub', 'bob-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'org-b'::text
  )::text;

  select is(
    (select count(*) from public.buildings where org_id = 'org-b'::uuid),
    1::bigint,
    'Firm B owner sees Firm B building'
  );

  -- TEST 4: Firm owner B cannot read org A buildings
  select is(
    (select count(*) from public.buildings where org_id = 'org-a'::uuid),
    0::bigint,
    'Firm B owner cannot see Firm A buildings'
  );

  -- TEST 5: Building manager A can read only building A
  set request.jwt.claims = json_build_object(
    'sub', 'alice-id'::text,
    'session_role', 'building_manager',
    'session_building_id', 'building-a1'::text,
    'accessible_building_ids', '["building-a1"]'::jsonb
  )::text;

  select is(
    (select count(*) from public.buildings where id = 'building-a1'::uuid),
    1::bigint,
    'Building manager A sees building A'
  );

  -- TEST 6: Building manager A cannot read building B
  select is(
    (select count(*) from public.buildings where id = 'building-b1'::uuid),
    0::bigint,
    'Building manager A cannot see building B'
  );

  select * from finish();
rollback;
