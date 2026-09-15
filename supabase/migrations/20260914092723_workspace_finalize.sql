-- Narrow visibility for archived legal records and keep document citation metadata current.
drop policy scoped_read on public.generated_documents;
create policy scoped_read on public.generated_documents for select to authenticated using(public.authorize('chat.use',building_id) and deleted_at is null);
drop policy scoped_read on public.disputes;
create policy scoped_read on public.disputes for select to authenticated using(public.authorize('dispute.read',building_id) and deleted_at is null);
create function private.document_metadata_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.effective_date is distinct from old.effective_date then
  update public.document_chunks set effective_date=new.effective_date where document_id=new.id and building_id=new.building_id;
 end if;
 if new.title<>old.title or new.effective_date is distinct from old.effective_date or new.knowledge_base_id is distinct from old.knowledge_base_id then
  update public.buildings set corpus_version=corpus_version+1 where id=new.building_id;
 end if;
 return new;
end; $$;
create trigger document_metadata_changed after update on public.documents for each row execute function private.document_metadata_changed();
create function public.pause_agent(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid;begin
 select building_id into b from public.agents where id=p_id and deleted_at is null;
 if not public.authorize('agent.deploy',b) then raise exception 'forbidden'; end if;
 update public.agents set status='paused' where id=p_id;
end; $$;
revoke all on function public.pause_agent(uuid) from public,anon;
grant execute on function public.pause_agent(uuid) to authenticated;
-- Restrict raw user-message data so client writes cannot inject tool or system parts into server history.
create function private.user_parts_are_text() returns trigger language plpgsql set search_path='' as $$
begin
 if new.role='user' and (jsonb_typeof(new.parts)<>'array' or jsonb_array_length(new.parts)<>1 or new.parts->0->>'type'<>'text' or jsonb_typeof(new.parts->0->'text')<>'string' or length(new.parts->0->>'text')>20000) then raise exception 'invalid_message_parts'; end if;
 return new;
end; $$;
create trigger validate_user_parts before insert on public.messages for each row execute function private.user_parts_are_text();

-- RLS still governs rows. Extension operators need EXECUTE for authenticated
-- invoker searches after the application-function grant reset in 0005.
do $$
declare extension_function regprocedure;
begin
 for extension_function in
  select p.oid::regprocedure
  from pg_catalog.pg_proc p
  join pg_catalog.pg_depend d on d.objid=p.oid and d.classid='pg_proc'::regclass and d.deptype='e'
  join pg_catalog.pg_extension e on e.oid=d.refobjid
  where e.extname in ('vector','pg_trgm')
 loop
  execute format('grant execute on function %s to authenticated',extension_function);
 end loop;
end; $$;
