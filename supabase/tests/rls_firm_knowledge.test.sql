-- supabase/tests/rls_firm_knowledge.test.sql
-- pgTAP tests for firm knowledge RLS isolation
-- Ensures firm documents cannot leak cross-org data

begin;
  select plan(8);

  -- Setup: Create two firms with different documents
  insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  values
    ('alice-id'::uuid, 'alice@firm-a.local', crypt('password', gen_salt('bf')), now(), now(), now()),
    ('bob-id'::uuid, 'bob@firm-b.local', crypt('password', gen_salt('bf')), now(), now(), now());

  insert into public.profiles (id, display_name, account_type, created_at)
  values
    ('alice-id'::uuid, 'Alice Owner A', 'admin', now()),
    ('bob-id'::uuid, 'Bob Owner B', 'admin', now());

  insert into public.organizations (id, name, created_by, kind, created_at)
  values
    ('firm-a'::uuid, 'Firm A', 'alice-id'::uuid, 'firm', now()),
    ('firm-b'::uuid, 'Firm B', 'bob-id'::uuid, 'firm', now());

  insert into public.org_members (id, org_id, user_id, role, status)
  values
    ('org-a-alice'::uuid, 'firm-a'::uuid, 'alice-id'::uuid, 'org_owner'::app_role, 'active'),
    ('org-b-bob'::uuid, 'firm-b'::uuid, 'bob-id'::uuid, 'org_owner'::app_role, 'active');

  -- Create test buildings
  insert into public.buildings (id, org_id, name, address, municipality, created_at)
  values
    ('building-a1'::uuid, 'firm-a'::uuid, 'Building A1', '123 Main', 'Vancouver', now()),
    ('building-b1'::uuid, 'firm-b'::uuid, 'Building B1', '456 Oak', 'Victoria', now());

  -- Create documents for each firm
  insert into public.firm_documents (id, firm_id, title, doc_kind, content_hash, created_by, published_at)
  values
    ('doc-a1'::uuid, 'firm-a'::uuid, 'Template A', 'template', 'hash-a1', 'alice-id'::uuid, now()),
    ('doc-b1'::uuid, 'firm-b'::uuid, 'Template B', 'template', 'hash-b1', 'bob-id'::uuid, now());

  -- TEST 1: Firm A owner can read Firm A published documents
  set request.jwt.claims = json_build_object(
    'sub', 'alice-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'firm-a'::text
  )::text;

  select is(
    (select count(*) from public.firm_documents where firm_id = 'firm-a'::uuid and published_at is not null),
    1::bigint,
    'Firm A owner can read Firm A documents'
  );

  -- TEST 2: Firm A owner cannot read Firm B documents
  select is(
    (select count(*) from public.firm_documents where firm_id = 'firm-b'::uuid),
    0::bigint,
    'Firm A owner cannot read Firm B documents'
  );

  -- TEST 3: Firm B owner can read Firm B published documents
  set request.jwt.claims = json_build_object(
    'sub', 'bob-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'firm-b'::text
  )::text;

  select is(
    (select count(*) from public.firm_documents where firm_id = 'firm-b'::uuid and published_at is not null),
    1::bigint,
    'Firm B owner can read Firm B documents'
  );

  -- TEST 4: Firm B owner cannot read Firm A documents
  select is(
    (select count(*) from public.firm_documents where firm_id = 'firm-a'::uuid),
    0::bigint,
    'Firm B owner cannot read Firm A documents'
  );

  -- TEST 5: Can insert documents when org member
  insert into public.firm_documents (id, firm_id, title, doc_kind, content_hash, created_by)
  values ('doc-b2'::uuid, 'firm-b'::uuid, 'New Doc', 'guide', 'hash-b2', 'bob-id'::uuid);

  select is(
    (select count(*) from public.firm_documents where created_by = 'bob-id'::uuid and published_at is null),
    1::bigint,
    'Can insert draft documents'
  );

  -- TEST 6: Firm A owner cannot insert into Firm B
  set request.jwt.claims = json_build_object(
    'sub', 'alice-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'firm-a'::text
  )::text;

  select throws_ok(
    'insert into public.firm_documents (id, firm_id, title, doc_kind, content_hash, created_by) values
     (''doc-fraud''::uuid, ''firm-b''::uuid, ''Fraud'', ''template'', ''hash-fraud'', ''alice-id''::uuid)',
    'new row violates row-level security policy',
    'Cannot insert into other firm'
  );

  -- TEST 7: Draft documents only visible to creator
  set request.jwt.claims = json_build_object(
    'sub', 'bob-id'::text,
    'session_role', 'org_owner',
    'session_org_id', 'firm-b'::text
  )::text;

  select is(
    (select count(*) from public.firm_documents where published_at is null and created_by = 'bob-id'::uuid),
    1::bigint,
    'Creator can see own draft documents'
  );

  -- TEST 8: Document chunks follow visibility
  insert into public.firm_document_chunks (document_id, firm_id, chunk_index, content)
  values ('doc-b1'::uuid, 'firm-b'::uuid, 1, 'Sample content');

  select is(
    (select count(*) from public.firm_document_chunks where document_id = 'doc-b1'::uuid),
    1::bigint,
    'Can read chunks from accessible documents'
  );

  select * from finish();
rollback;
