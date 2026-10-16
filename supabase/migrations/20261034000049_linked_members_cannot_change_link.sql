-- Decision D2 / D13 follow-up. Firm staff who are linked to a building now hold building_manager there, which carries
-- building.link_firm. Link actions belong to the building's own people, so a linked member may not revoke the firm link
-- or issue a new firm code. Before this, the first firm owner could remove their own firm (test: "does not let the firm
-- remove itself"). Only the guard changes; bodies are otherwise identical to the live definitions.
-- Rollback: recreate create_firm_code and revoke_firm_link without "or private.is_linked_member(p_building)".

CREATE OR REPLACE FUNCTION public.create_firm_code(p_building uuid, p_hash text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare c uuid;
begin
 if not public.authorize('building.link_firm',p_building) or private.is_linked_member(p_building) then raise exception 'forbidden'; end if;
 if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_input'; end if;
 if exists(select 1 from public.firm_building_links where building_id=p_building and status='active') then raise exception 'firm_already_linked'; end if;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values(p_building,'firm',p_hash,auth.uid(),now()+interval '7 days') returning id into c;
 return c;
end; $function$;

CREATE OR REPLACE FUNCTION public.revoke_firm_link(p_building uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare l uuid;
begin
 if not public.authorize('building.link_firm',p_building) or private.is_linked_member(p_building) then raise exception 'forbidden'; end if;
 select id into l from public.firm_building_links where building_id=p_building and status='active' for update;
 if not found then raise exception 'no_firm_link'; end if;
 update public.firm_building_links set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=l;
 -- New: pending invitations sent by the firm's staff die with the link, so no personal membership outlives it.
 update public.invitations set revoked_at=now() where building_id=p_building and accepted_at is null and revoked_at is null
  and invited_by in (select user_id from public.building_members where building_id=p_building and via_link_id=l);
 update public.building_members set status='suspended' where via_link_id=l;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 -- New: open firm reviews go back to their authors.
 insert into public.document_review_comments(document_id,building_id,author_id,body)
 select id,building_id,auth.uid(),'Strata management access was removed, so this review was returned to draft.' from public.generated_documents
 where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
 update public.generated_documents set status='draft',review_by='building',updated_at=now() where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
end; $function$;
