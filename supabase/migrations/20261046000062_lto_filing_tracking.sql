-- LTO filing tracking (PRD §6.5): validated filing references, the unfiled notice closes when the filing is recorded, and
-- an escalation schedule for the notice until then.
--
-- Escalation schedule (proposed; counsel and product to confirm, see docs/ROLE-FLOW-INVENTORY.md):
--   info      0 to 13 days after adoption
--   warning   14 to 59 days
--   critical  60 days or more
--
-- Filing reference format (proposed; counsel to confirm against the LTO's form): 3 to 30 characters, letters, digits,
-- hyphens and slashes, starting with a letter or digit, and containing at least one digit.
--
-- Changes to transition_bylaw: the 'filed' branch validates the reference and the effective date; the adoption notice starts
-- at 'info' (it escalates); the notice closes at 'filed', not at 'in_force'. Every other branch is unchanged.
--
-- Rollback: supabase/rollbacks/20261046000062_lto_filing_tracking.down.sql re-applies the previous transition_bylaw.

create or replace function public.lto_reference_valid(p text) returns boolean
language sql immutable set search_path='' as $$
  select p is not null and p ~ '^[A-Za-z0-9][A-Za-z0-9/-]{2,29}$' and p ~ '[0-9]';
$$;

create or replace function public.unfiled_notice_severity(p_created timestamptz, p_now timestamptz default now())
returns text language sql stable set search_path='' as $$
  select case
    when p_now - p_created >= interval '60 days' then 'critical'
    when p_now - p_created >= interval '14 days' then 'warning'
    else 'info'
  end;
$$;

-- Maintenance: brings the stored severity of every open unfiled notice up to the schedule. Run by the service role on a
-- schedule (the scheduled job is not wired yet). Authenticated users cannot run it.
create or replace function public.refresh_unfiled_notice_severity() returns integer
language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
  update public.notifications n
     set severity = public.unfiled_notice_severity(n.created_at)
   where n.type = 'unfiled_adoption'
     and n.state in ('new','viewed')
     and n.severity <> public.unfiled_notice_severity(n.created_at);
  get diagnostics changed = row_count;
  return changed;
end; $$;

revoke all on function public.refresh_unfiled_notice_severity() from public, anon, authenticated;
grant execute on function public.refresh_unfiled_notice_severity() to service_role;

create or replace function public.transition_bylaw(p_id uuid,p_status text,p_review text default null,p_filing text default null,p_effective date default null,p_for integer default null,p_against integer default null,p_abstain integer default null,p_override text default null) returns void language plpgsql security definer set search_path='' as $$
declare v public.bylaw_versions;
begin
 select * into v from public.bylaw_versions where id=p_id for update;
 if not found or not public.authorize('bylaw.adopt',v.building_id) then raise exception 'forbidden'; end if;
 if p_status='in_review' and v.status='draft' then update public.bylaw_versions set status=p_status,review_choice='counsel' where id=p_id;
 elsif p_status='proposed' and v.status in ('draft','in_review') then
  if p_review not in ('counsel','without_review') then raise exception 'review_required'; end if;
  -- No hardcoded legal-cap assertion. A lawyer must review potentially regulated terms.
  if v.body ~* '\m(fines?|rent|rents|rental|rentals|rented|renter|renters|renting|pets?|animals?|ages?|aged|discriminat[a-z]*)\M' and coalesce(length(p_override),0)<20 and p_review<>'counsel' then raise exception 'legal_review_required'; end if;
  update public.bylaw_versions set status=p_status,review_choice=p_review,override_reason=p_override where id=p_id;
 elsif p_status='voted' and v.status='proposed' and p_for>=0 and p_against>=0 and p_abstain>=0 and p_for+p_against>0 then
  update public.bylaw_versions set status=p_status,vote_for=p_for,vote_against=p_against,vote_abstain=p_abstain where id=p_id;
 elsif p_status='adopted' and v.status='voted' and 4*v.vote_for>=3*(v.vote_for+v.vote_against) then
  update public.bylaw_versions set status=p_status where id=p_id;
  insert into public.notifications(building_id,type,title,body,severity,target_id,dedupe_key) values(v.building_id,'unfiled_adoption','Filing record needed','Record and verify the LTO filing before this amendment is treated as in force.','info',v.id,'unfiled:'||v.id);
 elsif p_status='filed' and v.status='adopted' then
  -- Validate the trimmed value: that is the value stored.
  if not public.lto_reference_valid(trim(p_filing)) then raise exception 'invalid_filing_reference'; end if;
  if p_effective is null then raise exception 'effective_date_required'; end if;
  update public.bylaw_versions set status=p_status,filing_reference=trim(p_filing),effective_date=p_effective where id=p_id;
  update public.notifications set state='actioned' where target_id=v.id and type='unfiled_adoption';
 elsif p_status='in_force' and v.status='filed' and v.effective_date<=current_date then
  update public.bylaw_versions set status='superseded',effective_until=v.effective_date where node_id=v.node_id and status='in_force';
  update public.bylaw_versions set status='in_force' where id=p_id;
  update public.notifications set state='actioned' where target_id=v.id and type='unfiled_adoption';
  update public.buildings set corpus_version=corpus_version+1 where id=v.building_id;
 elsif p_status='in_force' and v.status='filed' and v.effective_date>current_date then raise exception 'not_yet_effective';
 elsif p_status in ('withdrawn','defeated') and v.status not in ('filed','in_force','superseded') then update public.bylaw_versions set status=p_status where id=p_id;
 else raise exception 'invalid_transition'; end if;
end; $$;
