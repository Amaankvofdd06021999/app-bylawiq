-- supabase/migrations/20261014_platform_audit_system.sql
-- Phase 3-4: Complete Audit Logging + Break-Glass Access
-- Comprehensive audit trail for all platform admin actions

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null, -- e.g., 'flag_changed', 'break_glass_read', 'org_created', etc.
  resource_type text, -- 'flag', 'document', 'organization', 'building', etc.
  resource_id uuid,
  resource_name text, -- For readability: flag name, document title, org name, etc.
  details jsonb, -- Additional context as JSON
  ip_address inet, -- IP address of admin
  user_agent text, -- User agent string
  occurred_at timestamptz not null default now()
);

create index platform_audit_log_admin_idx on public.platform_audit_log(admin_id, occurred_at desc);
create index platform_audit_log_action_idx on public.platform_audit_log(action, occurred_at desc);
create index platform_audit_log_resource_idx on public.platform_audit_log(resource_type, resource_id);
create index platform_audit_log_time_idx on public.platform_audit_log(occurred_at desc);

-- RLS: Only platform admin can read audit logs
alter table public.platform_audit_log enable row level security;

create policy platform_audit_read on public.platform_audit_log
  for select to authenticated
  using(
    exists(
      select 1 from public.org_members om
      where om.user_id = auth.uid()
      and om.role = 'platform_admin'
      and om.status = 'active'
    )
  );

-- RPC: Log an admin action
create or replace function public.log_admin_action(
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_resource_name text,
  p_details jsonb
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_log_id uuid;
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members
    where user_id = auth.uid() and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  insert into public.platform_audit_log (
    admin_id, action, resource_type, resource_id, resource_name, details
  ) values (
    auth.uid(),
    p_action,
    p_resource_type,
    p_resource_id,
    p_resource_name,
    p_details
  )
  returning id into v_log_id;

  return v_log_id;
end; $$;

-- RPC: Get recent audit logs (platform admin only)
create or replace function public.get_audit_logs(p_limit int default 50)
returns table(
  id uuid,
  admin_name text,
  action text,
  resource_type text,
  resource_name text,
  occurred_at timestamptz
) language plpgsql security definer set search_path='' as $$
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members
    where user_id = auth.uid() and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  return query
  select
    pal.id,
    coalesce(p.display_name, 'Unknown') as admin_name,
    pal.action,
    pal.resource_type,
    pal.resource_name,
    pal.occurred_at
  from public.platform_audit_log pal
  left join public.profiles p on p.id = pal.admin_id
  order by pal.occurred_at desc
  limit p_limit;
end; $$;

-- RPC: Break-glass read (with full audit)
create or replace function public.break_glass_read_document(p_document_id uuid)
returns table(
  id uuid,
  title text,
  type text,
  building_id uuid,
  org_id uuid,
  uploaded_by uuid,
  created_at timestamptz
) language plpgsql security definer set search_path='' as $$
declare
  v_doc_record record;
  v_org_id uuid;
begin
  -- Verify caller is platform admin
  if not exists(
    select 1 from public.org_members
    where user_id = auth.uid() and role = 'platform_admin' and status = 'active'
  ) then
    raise insufficient_privilege using message = 'Not a platform admin';
  end if;

  -- Get document and org details
  select d.id, d.title, d.type, d.building_id, b.org_id, d.uploaded_by, d.created_at
  into v_doc_record
  from public.documents d
  join public.buildings b on b.id = d.building_id
  where d.id = p_document_id;

  if v_doc_record is null then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  v_org_id := v_doc_record.org_id;

  -- Log the break-glass access
  insert into public.platform_audit_log (
    admin_id, action, resource_type, resource_id, resource_name, details
  ) values (
    auth.uid(),
    'break_glass_read',
    'document',
    p_document_id,
    v_doc_record.title,
    jsonb_build_object(
      'building_id', v_doc_record.building_id,
      'org_id', v_org_id,
      'document_type', v_doc_record.type
    )
  );

  -- TODO: Send notification to org about break-glass access
  -- For now, just log it

  return query
  select
    v_doc_record.id,
    v_doc_record.title,
    v_doc_record.type,
    v_doc_record.building_id,
    v_org_id,
    v_doc_record.uploaded_by,
    v_doc_record.created_at;
end; $$;

grant execute on function public.log_admin_action to authenticated;
grant execute on function public.get_audit_logs to authenticated;
grant execute on function public.break_glass_read_document to authenticated;
grant select on table public.platform_audit_log to authenticated;
