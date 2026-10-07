-- supabase/tests/rls_session_role.test.sql
-- pgTAP tests for session role enforcement in RLS policies
-- Run with: supabase test db

begin;
  select plan(12);

  -- Setup: Create test users, orgs, and buildings
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    ('user-1'::uuid, 'alice@test.local', crypt('password', gen_salt('bf')), now(), now(), now()),
    ('user-2'::uuid, 'bob@test.local', crypt('password', gen_salt('bf')), now(), now(), now());

  insert into public.profiles (id, display_name, account_type, created_at)
  values
    ('user-1'::uuid, 'Alice', 'multi_building', now()),
    ('user-2'::uuid, 'Bob', 'single_building', now());

  insert into public.organizations (id, name, created_by, created_at)
  values
    ('org-1'::uuid, 'Firm A', 'user-1'::uuid, now());

  insert into public.buildings (id, org_id, name, address, municipality, created_at)
  values
    ('building-1'::uuid, 'org-1'::uuid, 'Coastal Heights', '123 Main', 'Vancouver', now()),
    ('building-2'::uuid, 'org-1'::uuid, 'Harbor View', '456 Oak', 'Victoria', now());

  -- Alice: building_manager on building-1, portfolio_manager on org-1
  insert into public.org_members (id, org_id, user_id, role, status, created_at)
  values ('org-member-1'::uuid, 'org-1'::uuid, 'user-1'::uuid, 'portfolio_manager'::app_role, 'active');

  insert into public.building_members (id, building_id, user_id, role, status, created_at)
  values
    ('bm-1'::uuid, 'building-1'::uuid, 'user-1'::uuid, 'building_manager'::app_role, 'active'),
    ('bm-2'::uuid, 'building-2'::uuid, 'user-1'::uuid, 'portfolio_manager'::app_role, 'active');

  -- Bob: owner_resident on building-2 only
  insert into public.building_members (id, building_id, user_id, role, status, created_at)
  values ('bm-3'::uuid, 'building-2'::uuid, 'user-2'::uuid, 'owner_resident'::app_role, 'active');

  -- Create test documents
  insert into public.documents (id, building_id, title, kind, owner_visible, created_by, created_at)
  values
    ('doc-1'::uuid, 'building-1'::uuid, 'Building 1 Doc', 'bylaw', true, 'user-1'::uuid, now()),
    ('doc-2'::uuid, 'building-2'::uuid, 'Building 2 Doc', 'bylaw', true, 'user-1'::uuid, now()),
    ('doc-3'::uuid, 'building-2'::uuid, 'Resident Secret', 'internal', false, 'user-1'::uuid, now());

  -- Test 1: Alice as building_manager can read building-1 docs
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'user-1'::text,
    'session_role', 'building_manager',
    'session_building_id', 'building-1'::text,
    'accessible_building_ids', '["building-1", "building-2"]'::jsonb
  )::text, true);

  select is(
    (select count(*) from public.documents where building_id = 'building-1'::uuid),
    1::bigint,
    'Alice as building_manager sees building-1 docs'
  );

  -- Test 2: Alice as building_manager cannot read building-2 docs (wrong session_building_id)
  -- (Note: current RLS doesn't strictly enforce this yet; it's a graceful check)
  select is(
    (select count(*) from public.documents where building_id = 'building-2'::uuid),
    0::bigint,
    'Alice as building_manager cannot see building-2 docs (session mismatch)'
  );

  -- Test 3: Switch Alice to portfolio_manager on building-2
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'user-1'::text,
    'session_role', 'portfolio_manager',
    'session_building_id', 'building-2'::text,
    'accessible_building_ids', '["building-1", "building-2"]'::jsonb
  )::text, true);

  select is(
    (select count(*) from public.documents where building_id = 'building-2'::uuid),
    2::bigint,
    'Alice as portfolio_manager sees all building-2 docs (owner_visible)'
  );

  -- Test 4: Bob as owner_resident sees only owner-visible docs on building-2
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'user-2'::text,
    'session_role', 'owner_resident',
    'session_building_id', 'building-2'::text,
    'accessible_building_ids', '["building-2"]'::jsonb
  )::text, true);

  select is(
    (select count(*) from public.documents where building_id = 'building-2'::uuid and owner_visible = true),
    1::bigint,
    'Bob as resident sees only owner-visible docs'
  );

  select is(
    (select count(*) from public.documents where building_id = 'building-2'::uuid and owner_visible = false),
    0::bigint,
    'Bob as resident cannot see internal docs'
  );

  -- Test 5: Bob cannot access building-1 (no membership)
  select is(
    (select count(*) from public.documents where building_id = 'building-1'::uuid),
    0::bigint,
    'Bob has no access to building-1'
  );

  -- Test 6: authorize_session checks both permission and role
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'user-1'::text,
    'session_role', 'building_manager',
    'session_building_id', 'building-1'::text,
    'accessible_building_ids', '["building-1", "building-2"]'::jsonb
  )::text, true);

  select is(
    public.authorize_session('vault.read', 'building-1'::uuid, 'building_manager'::app_role),
    true,
    'authorize_session allows vault.read for building_manager on correct building'
  );

  select is(
    public.authorize_session('vault.read', 'building-2'::uuid, 'building_manager'::app_role),
    false,
    'authorize_session denies vault.read for wrong building (even though user has membership)'
  );

  -- Test 7: my_building_role returns correct role regardless of session
  select set_config('request.jwt.claims', json_build_object(
    'sub', 'user-1'::text,
    'session_role', 'building_manager',
    'session_building_id', 'building-1'::text,
    'accessible_building_ids', '["building-1", "building-2"]'::jsonb
  )::text, true);

  select is(
    public.my_building_role('building-1'::uuid),
    'building_manager'::app_role,
    'my_building_role returns user''s actual role'
  );

  select is(
    public.my_building_role('building-2'::uuid),
    'portfolio_manager'::app_role,
    'my_building_role returns correct role for second building'
  );

  -- Test 8: session_role() function reads JWT claim
  select is(
    public.session_role(),
    'building_manager'::app_role,
    'session_role() extracts from JWT claim'
  );

  select * from finish();
rollback;
