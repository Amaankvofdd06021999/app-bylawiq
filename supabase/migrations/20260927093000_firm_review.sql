-- supabase/migrations/20260927093000_firm_review.sql
-- A building can send a draft to its linked firm. Only the firm's reviewers decide; the building cannot approve
-- around them. Revoking the firm returns open reviews to draft.
-- Rollback: drop the functions created here; drop table public.document_review_comments;
--  update public.generated_documents set status='draft' where status='changes_requested';
--  alter table public.generated_documents drop constraint generated_documents_status_check,
--   add constraint generated_documents_status_check check(status in ('draft','pending_review','approved','sent','void')),
--   drop column review_by; re-apply the previous transition_artifact, save_artifact and revoke_firm_link.
alter table public.generated_documents add column review_by text not null default 'building' check(review_by in ('building','firm'));
alter table public.generated_documents drop constraint generated_documents_status_check;
alter table public.generated_documents add constraint generated_documents_status_check check(status in ('draft','pending_review','changes_requested','approved','sent','void'));

create table public.document_review_comments (
 id uuid primary key default gen_random_uuid(), document_id uuid not null, building_id uuid not null references public.buildings(id),
 author_id uuid not null references auth.users(id), body text not null check(length(body) between 1 and 4000),
 created_at timestamptz not null default now(),
 foreign key(document_id,building_id) references public.generated_documents(id,building_id)
);
create index document_review_comments_scope_idx on public.document_review_comments(building_id,document_id,created_at);
alter table public.document_review_comments enable row level security;
create policy review_comments_read on public.document_review_comments for select to authenticated using(public.authorize('chat.use',building_id));
revoke all on public.document_review_comments from public,anon,authenticated;
grant select on public.document_review_comments to authenticated;

create function private.is_linked_member(p_building uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.building_members m join public.firm_building_links l on l.id=m.via_link_id and l.status='active'
  where m.building_id=p_building and m.user_id=auth.uid() and m.status='active'); $$;

create function public.request_firm_review(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) or private.is_linked_member(d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
 if public.linked_firm_id(d.building_id) is null then raise exception 'no_firm_link'; end if;
 update public.generated_documents set status='pending_review',review_by='firm',updated_at=now() where id=p_id;
end; $$;

create function public.decide_firm_review(p_id uuid,p_decision text,p_comment text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; c text:=trim(coalesce(p_comment,''));
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('review.act',d.building_id) or not private.is_linked_member(d.building_id) then raise exception 'forbidden'; end if;
 if d.status<>'pending_review' or d.review_by<>'firm' or p_decision not in ('approved','changes_requested') then raise exception 'invalid_transition'; end if;
 if p_decision='changes_requested' and c='' then raise exception 'comment_required'; end if;
 if p_decision='approved' then
  if d.kind in ('s135_notice','decision_letter','fine_notice') and d.created_by=auth.uid() then raise exception 'self_approval_not_permitted'; end if;
  update public.generated_documents set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_id;
 else
  update public.generated_documents set status='changes_requested',updated_at=now() where id=p_id;
 end if;
 if c<>'' then insert into public.document_review_comments(document_id,building_id,author_id,body) values(d.id,d.building_id,auth.uid(),left(c,4000)); end if;
end; $$;

create function public.comment_on_review(p_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; i uuid;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null;
 if not found or not public.authorize('chat.use',d.building_id) then raise exception 'forbidden'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid_input'; end if;
 insert into public.document_review_comments(document_id,building_id,author_id,body) values(d.id,d.building_id,auth.uid(),trim(p_body)) returning id into i;
 return i;
end; $$;

-- Editing a draft sent back by the firm reopens it for the author.
create or replace function public.save_artifact(p_id uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','pending_review','changes_requested') then raise exception 'immutable_approved_document'; end if;
 insert into public.artifact_versions(building_id,artifact_id,body_md,edited_by) values(d.building_id,d.id,d.body_md,auth.uid());
 update public.generated_documents set title=p_title,body_md=p_body,status='draft',review_by='building',updated_at=now() where id=p_id;
end; $$;

create or replace function public.transition_artifact(p_id uuid,p_status text,p_occurred_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; sep boolean;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('chat.use',d.building_id) then raise exception 'forbidden'; end if;
 if d.status=p_status then return; end if;
 -- New: while the firm is reviewing, only decide_firm_review may move the document forward.
 if d.status='pending_review' and d.review_by='firm' and p_status<>'void' then raise exception 'firm_review_pending'; end if;
 if p_status='pending_review' and d.status in ('draft','changes_requested') and public.authorize('document.draft',d.building_id) then
  update public.generated_documents set status=p_status,review_by='building' where id=p_id;
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

create or replace function public.revoke_firm_link(p_building uuid) returns void language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 select id into l from public.firm_building_links where building_id=p_building and status='active' for update;
 if not found then raise exception 'no_firm_link'; end if;
 update public.firm_building_links set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=l;
 update public.building_members set status='suspended' where via_link_id=l;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 -- New: open firm reviews go back to their authors.
 insert into public.document_review_comments(document_id,building_id,author_id,body)
 select id,building_id,auth.uid(),'Strata management access was removed, so this review was returned to draft.' from public.generated_documents
 where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
 update public.generated_documents set status='draft',review_by='building',updated_at=now() where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
end; $$;

revoke all on function private.is_linked_member(uuid) from public,anon,authenticated;
revoke all on function public.request_firm_review(uuid),public.decide_firm_review(uuid,text,text),public.comment_on_review(uuid,text) from public,anon;
grant execute on function public.request_firm_review(uuid),public.decide_firm_review(uuid,text,text),public.comment_on_review(uuid,text) to authenticated;
