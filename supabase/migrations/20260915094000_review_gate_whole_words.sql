-- The legal-review keyword gate matched fragments inside other words ("garage", "storage", "damage", "current",
-- "carpet"), so almost every bylaw needed counsel or an override. It now matches whole words only, including
-- plural and inflected forms of the regulated terms.
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
