-- resident_audit_log had select grants and read policies but no way to write: the app inserted rows as the signed-in
-- user, which the table refuses (row-level security, no insert grant). Every verification and rate-limit audit row
-- was therefore dropped. This function records the caller's own event. It takes the user from auth.uid(), checks the
-- caller is an active member of that building, and accepts only the four actions the table allows.
-- Rollback: drop function public.log_resident_event(uuid, text, jsonb); the app then has no audit writer again.

create or replace function public.log_resident_event(p_building uuid, p_action text, p_details jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_action not in ('resident_question','resident_answer','verification_failed','rate_limit_hit') then
   raise exception 'invalid_input';
 end if;
 if not exists (select 1 from public.building_members m where m.building_id = p_building and m.user_id = auth.uid() and m.status = 'active') then
   raise exception 'forbidden';
 end if;
 insert into public.resident_audit_log(building_id, user_id, action, details)
 values (p_building, auth.uid(), p_action, coalesce(p_details, '{}'::jsonb));
end; $$;

revoke all on function public.log_resident_event(uuid, text, jsonb) from public, anon;
grant execute on function public.log_resident_event(uuid, text, jsonb) to authenticated;
