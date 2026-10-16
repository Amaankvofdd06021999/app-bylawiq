-- Rollback for supabase/migrations/20261037000052_platform_admin_reconciliation.sql.
--
-- NOT run by `supabase db reset` (it lives outside supabase/migrations). Run it by hand, against one environment at a
-- time, only if migration 52 must be undone. Restores the definitions that existed before migration 52.
--
-- Effect: the org_members platform-admin checks come back (they never matched, so they fail closed). Writes return to
-- platform_audit_log, and rows written to platform_admin_audit while migration 52 was applied stay in that table.
-- Run this in a transaction and check the result before commit.
--
-- Caveat: the pre-52 function bodies reference columns that do not exist (document_chunks.tsvector,
-- legal_chunks.jurisdiction/title, document_chunks.updated_at, organizations.type). Restoring them restores those
-- failures, which were masked because the admin check failed first. Migration 52 fixes them.

begin;

-- Policies -------------------------------------------------------------------

drop policy if exists building_regions_platform_admin_read on public.building_regions;
create policy building_regions_platform_admin_read on public.building_regions for select
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists building_regions_platform_admin_write on public.building_regions;
create policy building_regions_platform_admin_write on public.building_regions for all
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists intent_classifications_admin_update on public.intent_classifications;
create policy intent_classifications_admin_update on public.intent_classifications for update
  using (auth.uid() in (select org_members.user_id from public.org_members where org_members.role = 'platform_admin'::app_role and org_members.status = 'active'));

drop policy if exists intent_classifications_admin_write on public.intent_classifications;
create policy intent_classifications_admin_write on public.intent_classifications for insert
  with check (auth.uid() in (select org_members.user_id from public.org_members where org_members.role = 'platform_admin'::app_role and org_members.status = 'active'));

drop policy if exists onboarding_admin_insert on public.onboarding_workflows;
create policy onboarding_admin_insert on public.onboarding_workflows for insert
  with check ((auth.uid() = admin_id) and exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists onboarding_admin_read on public.onboarding_workflows;
create policy onboarding_admin_read on public.onboarding_workflows for select
  using ((admin_id = auth.uid()) and exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists onboarding_admin_write on public.onboarding_workflows;
create policy onboarding_admin_write on public.onboarding_workflows for update
  using ((admin_id = auth.uid()) and exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

create policy platform_audit_read on public.platform_audit_log for select
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));
grant select on table public.platform_audit_log to authenticated;

drop policy if exists regional_kb_platform_admin_read on public.regional_knowledge_bases;
create policy regional_kb_platform_admin_read on public.regional_knowledge_bases for select
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists regional_kb_platform_admin_write on public.regional_knowledge_bases;
create policy regional_kb_platform_admin_write on public.regional_knowledge_bases for update
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists resident_audit_admin_read on public.resident_audit_log;
create policy resident_audit_admin_read on public.resident_audit_log for select
  using (exists (select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin'::app_role and om.status = 'active'));

drop policy if exists security_events_admin_access on public.security_events;
create policy security_events_admin_access on public.security_events for all
  using ((auth.uid() in (select org_members.user_id from public.org_members where org_members.role = 'platform_admin'::app_role and org_members.status = 'active'))
    or (auth.uid() in (select building_members.user_id from public.building_members where building_members.building_id = security_events.building_id and building_members.role = 'building_manager'::app_role and building_members.status = 'active')));

-- Functions: pre-migration-52 definitions ------------------------------------

create or replace function public.get_flag(p_flag_name text) returns boolean language plpgsql stable security definer set search_path to ''
as $function$
declare v_enabled boolean;
begin
  if not exists(select 1 from public.org_members where user_id = (select auth.uid()) and role = 'platform_admin' and status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  select enabled into v_enabled from public.feature_flags where flag_name = p_flag_name;
  return coalesce(v_enabled, false);
end; $function$;

create or replace function public.log_admin_action(p_action text, p_resource_type text, p_resource_id uuid, p_resource_name text, p_details jsonb) returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_log_id uuid;
begin
  if not exists(select 1 from public.org_members where user_id = auth.uid() and role = 'platform_admin' and status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  insert into public.platform_audit_log (admin_id, action, resource_type, resource_id, resource_name, details)
  values (auth.uid(), p_action, p_resource_type, p_resource_id, p_resource_name, p_details)
  returning id into v_log_id;
  return v_log_id;
end; $function$;

create or replace function public.get_audit_logs(p_limit integer default 50)
returns table(id uuid, admin_name text, action text, resource_type text, resource_name text, occurred_at timestamp with time zone)
language plpgsql security definer set search_path to ''
as $function$
begin
  if not public.is_platform_admin() then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  return query
  select pal.id, coalesce(p.display_name, 'Unknown') as admin_name, pal.action, pal.resource_type, pal.resource_name, pal.occurred_at
  from public.platform_audit_log pal
  left join public.profiles p on p.id = pal.admin_id
  order by pal.occurred_at desc
  limit p_limit;
end; $function$;

create or replace function public.break_glass_read_document(p_document_id uuid)
returns table(id uuid, title text, type text, building_id uuid, org_id uuid, uploaded_by uuid, created_at timestamp with time zone)
language plpgsql security definer set search_path to ''
as $function$
declare v_doc_record record; v_org_id uuid;
begin
  if not exists(select 1 from public.org_members where user_id = auth.uid() and role = 'platform_admin' and status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  select d.id, d.title, d.type, d.building_id, b.org_id, d.uploaded_by, d.created_at into v_doc_record
  from public.documents d join public.buildings b on b.id = d.building_id where d.id = p_document_id;
  if v_doc_record is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;
  v_org_id := v_doc_record.org_id;
  insert into public.platform_audit_log (admin_id, action, resource_type, resource_id, resource_name, details)
  values (auth.uid(), 'break_glass_read', 'document', p_document_id, v_doc_record.title,
    jsonb_build_object('building_id', v_doc_record.building_id, 'org_id', v_org_id, 'document_type', v_doc_record.type));
  return query select v_doc_record.id, v_doc_record.title, v_doc_record.type, v_doc_record.building_id, v_org_id, v_doc_record.uploaded_by, v_doc_record.created_at;
end; $function$;

create or replace function public.get_all_regions()
returns table(id uuid, region_name text, jurisdiction text, building_count integer, document_count integer)
language plpgsql security definer set search_path to ''
as $function$
begin
  if not exists(select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin' and om.status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  return query
  select rkb.id, rkb.region_name, rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = rkb.id)::int,
    (select count(*) from public.documents d join public.building_regions br on br.building_id = d.building_id where br.region_id = rkb.id)::int
  from public.regional_knowledge_bases rkb
  order by rkb.region_name;
end; $function$;

create or replace function public.get_region_stats(p_region_id uuid)
returns table(region_name text, jurisdiction text, building_count integer, document_count integer, chunk_count integer, legal_chunk_count integer, last_updated timestamp with time zone)
language plpgsql security definer set search_path to ''
as $function$
begin
  if not exists(select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin' and om.status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  return query
  select rkb.region_name, rkb.jurisdiction,
    (select count(*) from public.building_regions br where br.region_id = p_region_id)::int as building_count,
    (select count(*) from public.documents d join public.building_regions br on br.building_id = d.building_id where br.region_id = p_region_id)::int as document_count,
    (select count(*) from public.document_chunks dc join public.documents d on d.id = dc.document_id join public.building_regions br on br.building_id = d.building_id where br.region_id = p_region_id)::int as chunk_count,
    (select count(*) from public.legal_chunks lc where lc.jurisdiction = rkb.jurisdiction)::int as legal_chunk_count,
    (select max(updated_at) from public.document_chunks dc join public.documents d on d.id = dc.document_id join public.building_regions br on br.building_id = d.building_id where br.region_id = p_region_id) as last_updated
  from public.regional_knowledge_bases rkb
  where rkb.id = p_region_id;
end; $function$;

create or replace function public.search_regional_kb(p_region_id uuid, p_query text, p_limit integer default 20)
returns table(chunk_id uuid, document_id uuid, document_title text, building_name text, content text, chunk_type text, relevance_score double precision)
language plpgsql security definer set search_path to ''
as $function$
declare v_query_tsvector tsquery; v_jurisdiction text;
begin
  if not exists(select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin' and om.status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  select jurisdiction into v_jurisdiction from public.regional_knowledge_bases where id = p_region_id;
  if v_jurisdiction is null then
    raise exception 'Region not found' using errcode = 'P0002';
  end if;
  v_query_tsvector := plainto_tsquery('english', p_query);
  return query
  (select dc.id, d.id, d.title, b.name, dc.content, 'building_document'::text, (ts_rank(dc.tsvector, v_query_tsvector))::float
    from public.document_chunks dc
    join public.documents d on d.id = dc.document_id
    join public.buildings b on b.id = d.building_id
    join public.building_regions br on br.building_id = b.id
    where br.region_id = p_region_id and dc.tsvector @@ v_query_tsvector
    order by ts_rank(dc.tsvector, v_query_tsvector) desc limit (p_limit / 2)::int)
  union all
  (select lc.id, null::uuid, lc.title, v_jurisdiction, lc.content, 'legal_corpus'::text, (ts_rank(lc.tsvector, v_query_tsvector))::float
    from public.legal_chunks lc
    where lc.jurisdiction = v_jurisdiction and lc.tsvector @@ v_query_tsvector
    order by ts_rank(lc.tsvector, v_query_tsvector) desc limit (p_limit / 2)::int);
end; $function$;

create or replace function public.search_universal_kb(p_query text, p_limit integer default 20)
returns table(chunk_id uuid, document_id uuid, document_title text, region_name text, building_name text, content text, chunk_type text, relevance_score double precision)
language plpgsql security definer set search_path to ''
as $function$
declare v_query_tsvector tsquery;
begin
  if not exists(select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin' and om.status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  v_query_tsvector := plainto_tsquery('english', p_query);
  return query
  select dc.id, d.id, d.title, rkb.region_name, b.name, dc.content, 'building_document'::text, (ts_rank(dc.tsvector, v_query_tsvector))::float
  from public.document_chunks dc
  join public.documents d on d.id = dc.document_id
  join public.buildings b on b.id = d.building_id
  join public.building_regions br on br.building_id = b.id
  join public.regional_knowledge_bases rkb on rkb.id = br.region_id
  where dc.tsvector @@ v_query_tsvector
  order by ts_rank(dc.tsvector, v_query_tsvector) desc
  limit (p_limit * 2)::int;
end; $function$;

create or replace function public.start_onboarding(p_firm_name text, p_firm_type text) returns uuid language plpgsql security definer set search_path to ''
as $function$
declare v_workflow_id uuid; v_org_id uuid;
begin
  if not exists(select 1 from public.org_members om where om.user_id = auth.uid() and om.role = 'platform_admin' and om.status = 'active') then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;
  insert into public.organizations (name, type) values (p_firm_name, p_firm_type) returning id into v_org_id;
  insert into public.onboarding_workflows (admin_id, org_id, step, firm_data)
  values (auth.uid(), v_org_id, 1, jsonb_build_object('firm_name', p_firm_name, 'firm_type', p_firm_type))
  returning id into v_workflow_id;
  perform public.log_admin_action('onboarding_started', 'organization', v_org_id, p_firm_name, jsonb_build_object('workflow_id', v_workflow_id));
  return v_workflow_id;
end; $function$;

commit;
