-- Bylaws imported from an already-registered PDF started as drafts and could only reach in_force through the
-- proposal, vote and adoption steps, so a registered bylaw needed an invented vote. An admin can now record the
-- existing LTO filing reference and effective date to mark an imported draft in force. Bylaws drafted in the
-- app still go through the full lifecycle.
alter table public.bylaw_versions add column source_document_id uuid;
alter table public.bylaw_versions add constraint bylaw_versions_source_document_fk foreign key(source_document_id,building_id) references public.documents(id,building_id);
alter table public.bylaw_versions drop constraint bylaw_versions_review_choice_check;
alter table public.bylaw_versions add constraint bylaw_versions_review_choice_check check(review_choice in ('counsel','without_review','registered'));
create or replace function public.confirm_document_structure(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.documents; s uuid; n uuid; item jsonb;
begin
 select * into d from public.documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('vault.upload',d.building_id) then raise exception 'forbidden'; end if;
 if d.status<>'review' then raise exception 'invalid_transition'; end if;
 if d.type='bylaws' then
  insert into public.bylaw_sets(building_id,title) values(d.building_id,d.title) returning id into s;
  for item in select value from jsonb_array_elements(d.parsed_sections) loop
   insert into public.bylaw_nodes(building_id,set_id,section_ref,title) values(d.building_id,s,item->>'sectionRef',item->>'heading') returning id into n;
   -- Imported drafts stay drafts until their filing record is entered through record_registered_bylaw.
   insert into public.bylaw_versions(building_id,node_id,version,body,created_by,source_document_id) values(d.building_id,n,1,item->>'content',auth.uid(),d.id);
  end loop;
 end if;
 update public.documents set structure_confirmed=true,status='ready' where id=p_id;
 update public.buildings set corpus_version=corpus_version+1 where id=d.building_id;
end; $$;
create function public.record_registered_bylaw(p_id uuid,p_filing text,p_effective date) returns void language plpgsql security definer set search_path='' as $$
declare v public.bylaw_versions;
begin
 select * into v from public.bylaw_versions where id=p_id for update;
 if not found or not public.authorize('bylaw.adopt',v.building_id) then raise exception 'forbidden'; end if;
 if v.status<>'draft' or v.source_document_id is null or length(trim(coalesce(p_filing,'')))<3 or p_effective is null or p_effective>current_date then raise exception 'invalid_transition'; end if;
 update public.bylaw_versions set status='superseded',effective_until=p_effective where node_id=v.node_id and status='in_force';
 update public.bylaw_versions set status='in_force',review_choice='registered',filing_reference=trim(p_filing),effective_date=p_effective where id=p_id;
 update public.buildings set corpus_version=corpus_version+1 where id=v.building_id;
end; $$;
revoke all on function public.record_registered_bylaw(uuid,text,date) from public,anon;
grant execute on function public.record_registered_bylaw(uuid,text,date) to authenticated;
