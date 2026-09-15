create table public.invitations (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
 email text not null, role public.app_role not null, invited_by uuid not null references auth.users(id),
 token_hash text not null unique, expires_at timestamptz not null default now()+interval '7 days',
 membership_expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index invitations_scope_idx on public.invitations(building_id);
alter table public.invitations enable row level security;
create policy invite_read on public.invitations for select to authenticated using(public.authorize('member.invite',building_id));
grant select(id,building_id,email,role,expires_at,accepted_at,revoked_at,created_at) on public.invitations to authenticated;
create function public.can_assign(p_building uuid,p_role public.app_role) returns boolean language sql stable security definer set search_path='' as $$
 select case public.my_building_role(p_building)
 when 'org_owner' then p_role not in ('platform_admin','org_owner')
 when 'org_admin' then p_role not in ('platform_admin','org_owner','org_admin')
 when 'portfolio_manager' then p_role in ('portfolio_assistant','building_manager','council_president','council_member','external_counsel','owner_resident')
 when 'building_manager' then p_role in ('council_member','external_counsel')
 when 'council_president' then p_role in ('council_member','external_counsel')
 else false end; $$;
create function public.create_invitation(p_building uuid,p_email text,p_role public.app_role,p_hash text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id where lower(u.email)=lower(p_email) and p.account_type='single_building' and p.bound_building_id<>p_building) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;
create function public.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'invalid_invitation'; end if;
 update public.profiles set account_type=coalesce(account_type,case when i.role in ('org_admin','org_owner') then 'admin'::public.account_type when i.role in ('portfolio_manager','portfolio_assistant') then 'multi_building'::public.account_type else 'single_building'::public.account_type end),consent_at=now() where id=auth.uid();
 insert into public.building_members(building_id,user_id,role,expires_at) values(i.building_id,auth.uid(),i.role,i.membership_expires_at) on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at;
 update public.invitations set accepted_at=now() where id=i.id;
 return i.building_id;
end; $$;
create function public.change_membership(p_id uuid,p_role public.app_role,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare m public.building_members;
begin
 select * into m from public.building_members where id=p_id for update;
 if not found or m.user_id=auth.uid() or not public.authorize('member.update_role',m.building_id) or not public.can_assign(m.building_id,m.role) or not public.can_assign(m.building_id,p_role) then raise exception 'forbidden'; end if;
 update public.building_members set role=p_role,status=case when p_remove then 'suspended' else 'active' end where id=p_id;
 -- All RLS checks consult live membership. Demotion/revocation takes effect on the very next statement.
end; $$;
create function public.revoke_invitation(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; begin select building_id into b from public.invitations where id=p_id;
 if not public.authorize('member.invite',b) then raise exception 'forbidden'; end if;
 update public.invitations set revoked_at=now() where id=p_id; end; $$;

-- Embedding shape and model are a pair. Replacing either requires a parallel column/index, re-embedding,
-- evaluation, atomic read switch, then delayed removal of the old column. Never pad or truncate vectors.
create function public.hybrid_search_building(p_building_id uuid,p_query_text text,p_query_embedding public.vector(1024),p_kb uuid default null,p_as_of date default null,p_types text[] default '{}',p_limit integer default 30)
returns table(chunk_id uuid,document_id uuid,building_id uuid,content text,heading text,section_ref text,page_from integer,effective_date date,title text,score double precision)
language sql stable security invoker set search_path=public as $$
 with eligible as (
  select c.*,d.title from public.document_chunks c join public.documents d on d.id=c.document_id
  where c.building_id=p_building_id and d.deleted_at is null and d.status='ready'
  and (p_kb is null or d.knowledge_base_id=p_kb) and (cardinality(p_types)=0 or d.type=any(p_types))
  and (d.effective_date is null or d.effective_date<=coalesce(p_as_of,current_date))
  and (d.effective_until is null or d.effective_until>coalesce(p_as_of,current_date))
  and (d.superseded_by is null or p_as_of is not null)
 ), sem as (
  select id,row_number() over(order by embedding<=>p_query_embedding) r from eligible where embedding<=>p_query_embedding<0.8 order by embedding<=>p_query_embedding limit 40
 ), kw as (
  select id,row_number() over(order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc) r from eligible where tsv@@websearch_to_tsquery('english',p_query_text) order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc limit 40
 ) select e.id,e.document_id,e.building_id,e.content,e.heading,e.section_ref,e.page_from,e.effective_date,e.title,
 (coalesce(1.0/(60+s.r),0)+coalesce(1.0/(60+k.r),0))::double precision score
 from eligible e left join sem s on s.id=e.id left join kw k on k.id=e.id where s.id is not null or k.id is not null order by score desc limit least(p_limit,40);
$$;
create function public.hybrid_search_legal(p_query_text text,p_query_embedding public.vector(1024),p_jurisdictions uuid[] default '{}',p_as_of date default null,p_limit integer default 30)
returns table(chunk_id uuid,source_id uuid,content text,heading text,section_ref text,title text,citation text,url text,effective_date date,score double precision)
language sql stable security invoker set search_path=public as $$
 with eligible as (
 select c.*,s.title,s.citation,s.url,s.in_force_from from public.legal_chunks c join public.legal_sources s on s.id=c.source_id
 join public.jurisdictions j on j.id=s.jurisdiction_id where s.verified_at is not null
 and (j.level in ('federal','provincial') or s.jurisdiction_id=any(p_jurisdictions))
 and (s.in_force_from is null or s.in_force_from<=coalesce(p_as_of,current_date)) and (s.in_force_to is null or s.in_force_to>coalesce(p_as_of,current_date))
 ), sem as(select id,row_number() over(order by embedding<=>p_query_embedding) r from eligible where embedding<=>p_query_embedding<0.8 order by embedding<=>p_query_embedding limit 40),
 kw as(select id,row_number() over(order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc) r from eligible where tsv@@websearch_to_tsquery('english',p_query_text) order by ts_rank_cd(tsv,websearch_to_tsquery('english',p_query_text)) desc limit 40)
 select e.id,e.source_id,e.content,e.heading,e.section_ref,e.title,e.citation,e.url,e.in_force_from,(coalesce(1.0/(60+s.r),0)+coalesce(1.0/(60+k.r),0))::double precision score
 from eligible e left join sem s on s.id=e.id left join kw k on k.id=e.id where s.id is not null or k.id is not null order by score desc limit least(p_limit,40);
$$;

create function public.confirm_document_structure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.documents; s uuid; n uuid; item jsonb;
begin
 select * into d from public.documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('vault.upload',d.building_id) then raise exception 'forbidden'; end if;
 if d.status<>'review' then raise exception 'invalid_transition'; end if;
 if d.type='bylaws' then
  insert into public.bylaw_sets(building_id,title) values(d.building_id,d.title) returning id into s;
  for item in select value from jsonb_array_elements(d.parsed_sections) loop
   insert into public.bylaw_nodes(building_id,set_id,section_ref,title) values(d.building_id,s,item->>'sectionRef',item->>'heading') returning id into n;
   -- Imported drafts remain drafts until filing and effective dates are verified through lifecycle controls.
   insert into public.bylaw_versions(building_id,node_id,version,body,created_by) values(d.building_id,n,1,item->>'content',auth.uid());
  end loop;
 end if;
 update public.documents set structure_confirmed=true,status='ready' where id=p_id;
 update public.buildings set corpus_version=corpus_version+1 where id=d.building_id;
end; $$;
revoke all on function public.create_invitation(uuid,text,public.app_role,text,timestamptz),public.accept_invitation(text),public.change_membership(uuid,public.app_role,boolean),public.revoke_invitation(uuid),public.confirm_document_structure(uuid) from public,anon;
grant execute on function public.create_invitation(uuid,text,public.app_role,text,timestamptz),public.accept_invitation(text),public.change_membership(uuid,public.app_role,boolean),public.revoke_invitation(uuid),public.confirm_document_structure(uuid) to authenticated;

-- Private storage: no public URLs, no overwrite, only authorized uploads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('vault','vault',false,20971520,array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) on conflict(id) do nothing;
create policy vault_read on storage.objects for select to authenticated using(bucket_id='vault' and exists(select 1 from public.documents d where d.storage_path=name and d.deleted_at is null));
create policy vault_upload on storage.objects for insert to authenticated with check(bucket_id='vault' and public.authorize('vault.upload',((storage.foldername(name))[1])::uuid));

-- Guard direct role grants in deployments where Supabase default privileges grant all tables.
revoke insert,update,delete on public.audit_log,public.org_members,public.building_members,public.role_permissions,public.document_chunks,public.document_versions,public.agent_deployments,public.bylaw_sets,public.bylaw_nodes,public.bylaw_versions,public.dispute_events,public.artifact_versions,public.notifications,public.invitations,public.legal_sources,public.legal_chunks,public.jurisdictions from authenticated,anon;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
