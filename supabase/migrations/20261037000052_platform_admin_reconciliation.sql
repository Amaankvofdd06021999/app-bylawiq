-- Reconcile every platform-admin policy and function with the platform_admins model (migration 50).
--
-- Before: 12 policies and 9 functions tested org_members for role 'platform_admin'. That role cannot exist on an
-- organisation member (the identity migration forbids it), so those checks never matched and failed closed.
-- After: every check calls public.is_platform_admin(), which requires a platform_admins row AND an aal2 session.
--
-- Audit consolidation: public.platform_admin_audit is the single audit table. The app already writes to it, and its
-- RLS already uses is_platform_admin(). get_audit_logs, log_admin_action, break_glass_read_document and start_onboarding
-- now write to and read from it. public.platform_audit_log keeps its rows but loses its client read policy, so
-- authenticated users can no longer read it.
--
-- NOT in this migration: copying existing platform_audit_log rows into platform_admin_audit. That is a data change and
-- needs its own approved backfill (preview, row counts, rollback). Until it runs, pre-existing rows exist only in
-- platform_audit_log.
--
-- Rollback: restore the previous definitions from migrations 14, 28, 31 and 50. Policies must be recreated with their
-- org_members predicates. This is not recommended, because those predicates fail closed and cannot match.

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------

drop policy if exists building_regions_platform_admin_read on public.building_regions;
create policy building_regions_platform_admin_read on public.building_regions
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists building_regions_platform_admin_write on public.building_regions;
create policy building_regions_platform_admin_write on public.building_regions
  for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists intent_classifications_admin_update on public.intent_classifications;
create policy intent_classifications_admin_update on public.intent_classifications
  for update to authenticated
  using (public.is_platform_admin());

drop policy if exists intent_classifications_admin_write on public.intent_classifications;
create policy intent_classifications_admin_write on public.intent_classifications
  for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists onboarding_admin_insert on public.onboarding_workflows;
create policy onboarding_admin_insert on public.onboarding_workflows
  for insert to authenticated
  with check ((select auth.uid()) = admin_id and public.is_platform_admin());

drop policy if exists onboarding_admin_read on public.onboarding_workflows;
create policy onboarding_admin_read on public.onboarding_workflows
  for select to authenticated
  using (admin_id = (select auth.uid()) and public.is_platform_admin());

drop policy if exists onboarding_admin_write on public.onboarding_workflows;
create policy onboarding_admin_write on public.onboarding_workflows
  for update to authenticated
  using (admin_id = (select auth.uid()) and public.is_platform_admin());

drop policy if exists platform_audit_read on public.platform_audit_log;
-- No client policy remains, so RLS denies every authenticated read of the legacy table.
revoke select on table public.platform_audit_log from authenticated;

drop policy if exists regional_kb_platform_admin_read on public.regional_knowledge_bases;
create policy regional_kb_platform_admin_read on public.regional_knowledge_bases
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists regional_kb_platform_admin_write on public.regional_knowledge_bases;
create policy regional_kb_platform_admin_write on public.regional_knowledge_bases
  for update to authenticated
  using (public.is_platform_admin());

drop policy if exists resident_audit_admin_read on public.resident_audit_log;
create policy resident_audit_admin_read on public.resident_audit_log
  for select to authenticated
  using (public.is_platform_admin());

drop policy if exists security_events_admin_access on public.security_events;
create policy security_events_admin_access on public.security_events
  for all to authenticated
  using (
    public.is_platform_admin()
    or (select auth.uid()) in (
      select bm.user_id
      from public.building_members bm
      where bm.building_id = security_events.building_id
        and bm.role = 'building_manager'
        and bm.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- Functions
-- ---------------------------------------------------------------------------

create or replace function public.get_flag(p_flag_name text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_enabled boolean;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select enabled into v_enabled from public.feature_flags where flag_name = p_flag_name;
  return coalesce(v_enabled, false);
end; $function$;

create or replace function public.log_admin_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_resource_name text,
  p_details jsonb
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_log_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  insert into public.platform_admin_audit (admin_id, action, resource_type, resource_id, details)
  values (
    (select auth.uid()),
    p_action,
    p_resource_type,
    p_resource_id,
    coalesce(p_details, '{}'::jsonb) || jsonb_build_object('resource_name', p_resource_name)
  )
  returning id into v_log_id;

  return v_log_id;
end; $function$;

create or replace function public.get_audit_logs(p_limit integer default 50)
returns table(
  id uuid,
  admin_name text,
  action text,
  resource_type text,
  resource_name text,
  occurred_at timestamp with time zone
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  -- Verify caller is a platform admin with MFA (decision D15)
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    a.id,
    coalesce(p.display_name, 'Unknown') as admin_name,
    a.action,
    a.resource_type,
    a.details ->> 'resource_name' as resource_name,
    a.created_at as occurred_at
  from public.platform_admin_audit a
  left join public.profiles p on p.id = a.admin_id
  order by a.created_at desc
  limit p_limit;
end; $function$;

create or replace function public.break_glass_read_document(p_document_id uuid)
returns table(
  id uuid,
  title text,
  type text,
  building_id uuid,
  org_id uuid,
  uploaded_by uuid,
  created_at timestamp with time zone
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_doc_record record;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select d.id, d.title, d.type, d.building_id, b.org_id, d.uploaded_by, d.created_at
  into v_doc_record
  from public.documents d
  join public.buildings b on b.id = d.building_id
  where d.id = p_document_id;

  if v_doc_record is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  insert into public.platform_admin_audit (admin_id, action, resource_type, resource_id, details)
  values (
    (select auth.uid()),
    'break_glass_read',
    'document',
    p_document_id,
    jsonb_build_object(
      'resource_name', v_doc_record.title,
      'building_id', v_doc_record.building_id,
      'org_id', v_doc_record.org_id,
      'document_type', v_doc_record.type
    )
  );

  return query
  select
    v_doc_record.id,
    v_doc_record.title,
    v_doc_record.type,
    v_doc_record.building_id,
    v_doc_record.org_id,
    v_doc_record.uploaded_by,
    v_doc_record.created_at;
end; $function$;

create or replace function public.get_all_regions()
returns table(
  id uuid,
  region_name text,
  jurisdiction text,
  building_count integer,
  document_count integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    rkb.id,
    rkb.region_name,
    rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = rkb.id)::int,
    (
      select count(*) from public.documents d
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = rkb.id
    )::int
  from public.regional_knowledge_bases rkb
  order by rkb.region_name;
end; $function$;

create or replace function public.get_region_stats(p_region_id uuid)
returns table(
  region_name text,
  jurisdiction text,
  building_count integer,
  document_count integer,
  chunk_count integer,
  legal_chunk_count integer,
  last_updated timestamp with time zone
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    rkb.region_name,
    rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = p_region_id)::int as building_count,
    (
      select count(*) from public.documents d
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    )::int as document_count,
    (
      select count(*) from public.document_chunks dc
      join public.documents d on d.id = dc.document_id
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    )::int as chunk_count,
    (
      select count(*) from public.legal_chunks lc
      join public.legal_sources ls on ls.id = lc.source_id
      join public.jurisdictions j on j.id = ls.jurisdiction_id
      where j.code = rkb.jurisdiction
    )::int as legal_chunk_count,
    (
      select max(dc.created_at) from public.document_chunks dc
      join public.documents d on d.id = dc.document_id
      join public.building_regions br on br.building_id = d.building_id
      where br.region_id = p_region_id
    ) as last_updated
  from public.regional_knowledge_bases rkb
  where rkb.id = p_region_id;
end; $function$;

create or replace function public.search_regional_kb(p_region_id uuid, p_query text, p_limit integer default 20)
returns table(
  chunk_id uuid,
  document_id uuid,
  document_title text,
  building_name text,
  content text,
  chunk_type text,
  relevance_score double precision
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_query_tsvector tsquery;
  v_jurisdiction text;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  select jurisdiction into v_jurisdiction from public.regional_knowledge_bases where id = p_region_id;
  if v_jurisdiction is null then
    raise exception 'Region not found' using errcode = 'P0002';
  end if;

  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  (select
    dc.id,
    d.id,
    d.title,
    b.name,
    dc.content,
    'building_document'::text,
    (ts_rank(dc.tsv, v_query_tsvector))::float
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.buildings b on b.id = d.building_id
  join public.building_regions br on br.building_id = b.id
  where br.region_id = p_region_id
  and dc.tsv @@ v_query_tsvector
  order by ts_rank(dc.tsv, v_query_tsvector) desc
  limit (p_limit / 2)::int)

  union all

  (select
    lc.id,
    null::uuid,
    coalesce(ls.title, lc.heading),
    v_jurisdiction,
    lc.content,
    'legal_corpus'::text,
    (ts_rank(lc.tsv, v_query_tsvector))::float
  from public.legal_chunks lc
  join public.legal_sources ls on ls.id = lc.source_id
  join public.jurisdictions j on j.id = ls.jurisdiction_id
  where j.code = v_jurisdiction
  and lc.tsv @@ v_query_tsvector
  order by ts_rank(lc.tsv, v_query_tsvector) desc
  limit (p_limit / 2)::int);
end; $function$;

create or replace function public.search_universal_kb(p_query text, p_limit integer default 20)
returns table(
  chunk_id uuid,
  document_id uuid,
  document_title text,
  region_name text,
  building_name text,
  content text,
  chunk_type text,
  relevance_score double precision
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_query_tsvector tsquery;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  v_query_tsvector := plainto_tsquery('english', p_query);

  return query
  select
    dc.id,
    d.id,
    d.title,
    rkb.region_name,
    b.name,
    dc.content,
    'building_document'::text,
    (ts_rank(dc.tsv, v_query_tsvector))::float
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.buildings b on b.id = d.building_id
  join public.building_regions br on br.building_id = b.id
  join public.regional_knowledge_bases rkb on rkb.id = br.region_id
  where dc.tsv @@ v_query_tsvector
  order by ts_rank(dc.tsv, v_query_tsvector) desc
  limit (p_limit * 2)::int;
end; $function$;

create or replace function public.start_onboarding(p_firm_name text, p_firm_type text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_workflow_id uuid;
  v_org_id uuid;
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  -- organizations.kind is 'firm' or 'building'; the requested firm type is kept on the workflow.
  insert into public.organizations (name, kind, created_by)
  values (p_firm_name, 'firm', (select auth.uid()))
  returning id into v_org_id;

  insert into public.onboarding_workflows (admin_id, org_id, step, firm_data)
  values (
    (select auth.uid()),
    v_org_id,
    1,
    jsonb_build_object('firm_name', p_firm_name, 'firm_type', p_firm_type)
  )
  returning id into v_workflow_id;

  perform public.log_admin_action(
    'onboarding_started',
    'organization',
    v_org_id,
    p_firm_name,
    jsonb_build_object('workflow_id', v_workflow_id)
  );

  return v_workflow_id;
end; $function$;
