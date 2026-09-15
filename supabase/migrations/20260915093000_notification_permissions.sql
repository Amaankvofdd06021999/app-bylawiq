-- update_notification only required chat.use, which council members and external counsel hold, so read-only
-- roles could dismiss or snooze the unfiled-adoption warning. Marking an update viewed stays open to anyone who
-- can read the building; every other state change now needs bylaw.adopt, matching who may adopt and file bylaws.
create or replace function public.update_notification(p_id uuid,p_state text,p_reason text default null,p_until date default null) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; begin
 select building_id into b from public.notifications where id=p_id;
 if not public.authorize(case when p_state='viewed' then 'building.read' else 'bylaw.adopt' end,b) then raise exception 'forbidden'; end if;
 if p_state='dismissed' and coalesce(length(p_reason),0)<3 then raise exception 'reason_required'; end if;
 if p_state='snoozed' and (p_until is null or p_until<=current_date) then raise exception 'date_required'; end if;
 update public.notifications set state=p_state,dismissal_reason=p_reason,snoozed_until=p_until where id=p_id;
end; $$;
