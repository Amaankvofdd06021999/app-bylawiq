create table public.bylaw_sets (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id), title text not null,
 created_at timestamptz not null default now(), unique(id,building_id)
);
create table public.bylaw_nodes (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id), set_id uuid not null,
 section_ref text not null, title text not null, parent_id uuid, created_at timestamptz not null default now(), unique(id,building_id),
 foreign key(set_id,building_id) references public.bylaw_sets(id,building_id), foreign key(parent_id,building_id) references public.bylaw_nodes(id,building_id)
);
create table public.bylaw_versions (
 id uuid primary key default gen_random_uuid(), building_id uuid not null, node_id uuid not null, version integer not null,
 body text not null, rationale text not null default '', status text not null default 'draft'
 check(status in ('draft','in_review','proposed','voted','adopted','filed','in_force','superseded','withdrawn','defeated')),
 effective_date date, effective_until date, filing_reference text, vote_for integer, vote_against integer, vote_abstain integer,
 review_choice text check(review_choice in ('counsel','without_review')), override_reason text,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(node_id,building_id) references public.bylaw_nodes(id,building_id), unique(node_id,version), unique(id,building_id),
 check(status not in ('filed','in_force') or (filing_reference is not null and length(filing_reference)>2 and effective_date is not null)),
 check(status not in ('proposed','voted','adopted','filed','in_force') or review_choice is not null)
);
create unique index bylaw_in_force_idx on public.bylaw_versions(node_id) where status='in_force';
create table public.bylaw_comments (
 id uuid primary key default gen_random_uuid(), building_id uuid not null, version_id uuid not null, user_id uuid not null references auth.users(id), body text not null,
 created_at timestamptz not null default now(), foreign key(version_id,building_id) references public.bylaw_versions(id,building_id)
);
create table public.disputes (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id), reference text not null,
 title text not null, category text not null default 'other', subject_unit text, stage text not null default 'reported',
 opened_by uuid not null references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,building_id), unique(building_id,reference)
);
create table public.dispute_events (
 id uuid primary key default gen_random_uuid(), building_id uuid not null, dispute_id uuid not null,
 stage text not null, occurred_at timestamptz not null, logged_at timestamptz not null default now(), summary text not null,
 actor_id uuid not null references auth.users(id), idempotency_key uuid not null unique,
 foreign key(dispute_id,building_id) references public.disputes(id,building_id)
);
create index dispute_timeline_idx on public.dispute_events(dispute_id,occurred_at);
create table public.generated_documents (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id), dispute_id uuid,
 kind text not null, title text not null, body_md text not null, status text not null default 'draft'
 check(status in ('draft','pending_review','approved','sent','void')),
 created_by uuid not null references auth.users(id), approved_by uuid references auth.users(id), approved_at timestamptz, sent_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,building_id), foreign key(dispute_id,building_id) references public.disputes(id,building_id),
 check(status not in ('approved','sent') or (approved_by is not null and approved_at is not null)),
 check(status<>'sent' or sent_at is not null)
);
create table public.artifact_versions (
 id uuid primary key default gen_random_uuid(), building_id uuid not null, artifact_id uuid not null,
 body_md text not null, edited_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 foreign key(artifact_id,building_id) references public.generated_documents(id,building_id)
);
create table public.notifications (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id), type text not null,
 title text not null, body text not null, severity text not null default 'info', target_id uuid,
 state text not null default 'new' check(state in ('new','viewed','actioned','dismissed','snoozed')),
 dismissal_reason text, snoozed_until date, created_at timestamptz not null default now(), dedupe_key text unique
);
do $$ declare t text; begin
 foreach t in array array['bylaw_sets','bylaw_nodes','bylaw_versions','bylaw_comments','disputes','dispute_events','generated_documents','artifact_versions','notifications'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index %I on public.%I(building_id)',t||'_scope_idx',t);
  execute format('create policy scoped_read on public.%I for select to authenticated using(public.authorize(''chat.use'',building_id))',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['bylaw_sets','bylaw_nodes','bylaw_versions','disputes','generated_documents'] loop
  execute format('create trigger audit_resource after insert or update on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;
create policy bylaw_comments_insert on public.bylaw_comments for insert to authenticated with check(public.authorize('chat.use',building_id) and user_id=auth.uid());
grant insert on public.bylaw_comments to authenticated;
create policy dispute_insert on public.disputes for insert to authenticated with check(public.authorize('dispute.create',building_id) and opened_by=auth.uid());
create policy dispute_update on public.disputes for update to authenticated using(public.authorize('dispute.update',building_id));
grant insert on public.disputes to authenticated;
grant update(title,category,subject_unit,deleted_at) on public.disputes to authenticated;
create policy notices_insert on public.generated_documents for insert to authenticated with check(public.authorize('document.draft',building_id) and created_by=auth.uid() and status='draft' and approved_by is null and approved_at is null and sent_at is null);
grant insert on public.generated_documents to authenticated;
-- No direct UPDATE on notices, versions or legal timelines: all transition checks below run in the database.

create function public.save_artifact(p_id uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','pending_review') then raise exception 'immutable_approved_document'; end if;
 insert into public.artifact_versions(building_id,artifact_id,body_md,edited_by) values(d.building_id,d.id,d.body_md,auth.uid());
 update public.generated_documents set title=p_title,body_md=p_body,status='draft',updated_at=now() where id=p_id;
end; $$;
create function public.transition_artifact(p_id uuid,p_status text,p_occurred_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; sep boolean;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('chat.use',d.building_id) then raise exception 'forbidden'; end if;
 if d.status=p_status then return; end if;
 if p_status='pending_review' and d.status='draft' and public.authorize('document.draft',d.building_id) then
  update public.generated_documents set status=p_status where id=p_id;
 elsif p_status='approved' and d.status='pending_review' and public.authorize('document.approve',d.building_id) then
  select o.separation_of_duties into sep from public.organizations o join public.buildings b on b.org_id=o.id where b.id=d.building_id;
  if sep and d.kind in ('s135_notice','decision_letter','fine_notice') and d.created_by=auth.uid() then raise exception 'self_approval_not_permitted'; end if;
  update public.generated_documents set status='approved',approved_by=auth.uid(),approved_at=now() where id=p_id;
 elsif p_status='sent' and d.status='approved' and public.authorize('document.send',d.building_id) then
  if p_occurred_at is null or p_occurred_at>now() then raise exception 'invalid_occurred_at'; end if;
  update public.generated_documents set status='sent',sent_at=p_occurred_at where id=p_id;
  if d.dispute_id is not null then
   insert into public.dispute_events(building_id,dispute_id,stage,occurred_at,summary,actor_id,idempotency_key) values(d.building_id,d.dispute_id,'notice_sent',p_occurred_at,'Approved correspondence marked as sent',auth.uid(),d.id) on conflict(idempotency_key) do nothing;
  end if;
 elsif p_status='void' and d.status<>'sent' and public.authorize('document.approve',d.building_id) then update public.generated_documents set status='void',deleted_at=now() where id=p_id;
 else raise exception 'invalid_transition'; end if;
end; $$;
create function public.log_dispute_event(p_dispute_id uuid,p_stage text,p_occurred_at timestamptz,p_summary text,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare b uuid; e uuid;
begin
 select building_id into b from public.disputes where id=p_dispute_id and deleted_at is null for update;
 if not public.authorize('dispute.update',b) then raise exception 'forbidden'; end if;
 if p_stage not in ('reported','investigating','warning_sent','notice_sent','hearing_offered','hearing_held','decision_issued','fine_levied','resolved','escalated_crt','withdrawn') or p_occurred_at>now() then raise exception 'invalid_input'; end if;
 insert into public.dispute_events(building_id,dispute_id,stage,occurred_at,summary,actor_id,idempotency_key) values(b,p_dispute_id,p_stage,p_occurred_at,p_summary,auth.uid(),p_key) on conflict(idempotency_key) do nothing returning id into e;
 if e is not null then update public.disputes set stage=p_stage where id=p_dispute_id; end if;
 return e;
end; $$;
create function public.save_bylaw(p_building_id uuid,p_node_id uuid,p_title text,p_section text,p_body text,p_rationale text) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid; n uuid:=p_node_id; v uuid; seq integer;
begin
 if not public.authorize('bylaw.edit',p_building_id) then raise exception 'forbidden'; end if;
 perform 1 from public.buildings where id=p_building_id for update;
 if n is null then
  select id into s from public.bylaw_sets where building_id=p_building_id limit 1;
  if s is null then insert into public.bylaw_sets(building_id,title) values(p_building_id,'Building bylaws') returning id into s; end if;
  insert into public.bylaw_nodes(building_id,set_id,section_ref,title) values(p_building_id,s,p_section,p_title) returning id into n;
 elsif not exists(select 1 from public.bylaw_nodes where id=n and building_id=p_building_id) then raise exception 'forbidden'; end if;
 select coalesce(max(version),0)+1 into seq from public.bylaw_versions where node_id=n;
 insert into public.bylaw_versions(building_id,node_id,version,body,rationale,created_by) values(p_building_id,n,seq,p_body,p_rationale,auth.uid()) returning id into v;
 return v;
end; $$;
create function public.transition_bylaw(p_id uuid,p_status text,p_review text default null,p_filing text default null,p_effective date default null,p_for integer default null,p_against integer default null,p_abstain integer default null,p_override text default null) returns void language plpgsql security definer set search_path='' as $$
declare v public.bylaw_versions;
begin
 select * into v from public.bylaw_versions where id=p_id for update;
 if not found or not public.authorize('bylaw.adopt',v.building_id) then raise exception 'forbidden'; end if;
 if p_status='in_review' and v.status='draft' then update public.bylaw_versions set status=p_status,review_choice='counsel' where id=p_id;
 elsif p_status='proposed' and v.status in ('draft','in_review') then
  if p_review not in ('counsel','without_review') then raise exception 'review_required'; end if;
  -- No hardcoded legal-cap assertion. A lawyer must review potentially regulated terms.
  if v.body ~* '(fine|rent|pet|animal|age|discriminat)' and coalesce(length(p_override),0)<20 and p_review<>'counsel' then raise exception 'legal_review_required'; end if;
  update public.bylaw_versions set status=p_status,review_choice=p_review,override_reason=p_override where id=p_id;
 elsif p_status='voted' and v.status='proposed' and p_for>=0 and p_against>=0 and p_abstain>=0 and p_for+p_against>0 then
  update public.bylaw_versions set status=p_status,vote_for=p_for,vote_against=p_against,vote_abstain=p_abstain where id=p_id;
 elsif p_status='adopted' and v.status='voted' and 4*v.vote_for>=3*(v.vote_for+v.vote_against) then
  update public.bylaw_versions set status=p_status where id=p_id;
  insert into public.notifications(building_id,type,title,body,severity,target_id,dedupe_key) values(v.building_id,'unfiled_adoption','Filing record needed','Record and verify the LTO filing before this amendment is treated as in force.','warning',v.id,'unfiled:'||v.id);
 elsif p_status='filed' and v.status='adopted' and length(p_filing)>2 and p_effective is not null then
  update public.bylaw_versions set status=p_status,filing_reference=p_filing,effective_date=p_effective where id=p_id;
 elsif p_status='in_force' and v.status='filed' and v.effective_date<=current_date then
  update public.bylaw_versions set status='superseded',effective_until=v.effective_date where node_id=v.node_id and status='in_force';
  update public.bylaw_versions set status='in_force' where id=p_id;
  update public.notifications set state='actioned' where target_id=v.id and type='unfiled_adoption';
  update public.buildings set corpus_version=corpus_version+1 where id=v.building_id;
 elsif p_status in ('withdrawn','defeated') and v.status not in ('filed','in_force','superseded') then update public.bylaw_versions set status=p_status where id=p_id;
 else raise exception 'invalid_transition'; end if;
end; $$;
create function public.update_notification(p_id uuid,p_state text,p_reason text default null,p_until date default null) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; begin
 select building_id into b from public.notifications where id=p_id;
 if not public.authorize('chat.use',b) then raise exception 'forbidden'; end if;
 if p_state='dismissed' and coalesce(length(p_reason),0)<3 then raise exception 'reason_required'; end if;
 if p_state='snoozed' and (p_until is null or p_until<=current_date) then raise exception 'date_required'; end if;
 update public.notifications set state=p_state,dismissal_reason=p_reason,snoozed_until=p_until where id=p_id;
end; $$;
revoke all on function public.save_artifact(uuid,text,text),public.transition_artifact(uuid,text,timestamptz),public.log_dispute_event(uuid,text,timestamptz,text,uuid),public.save_bylaw(uuid,uuid,text,text,text,text),public.transition_bylaw(uuid,text,text,text,date,integer,integer,integer,text),public.update_notification(uuid,text,text,date) from public,anon;
grant execute on function public.save_artifact(uuid,text,text),public.transition_artifact(uuid,text,timestamptz),public.log_dispute_event(uuid,text,timestamptz,text,uuid),public.save_bylaw(uuid,uuid,text,text,text,text),public.transition_bylaw(uuid,text,text,text,date,integer,integer,integer,text),public.update_notification(uuid,text,text,date) to authenticated;
