-- The person who creates a firm building is its owner, not a guest of the firm link, so their membership is ordinary
-- (no via_link_id). Other firm staff added through the link stay linked and follow the link's status.
-- Rollback: recreate private.create_firm_building without the final update, and set via_link_id back on those rows.

create or replace function private.create_firm_building(p_firm uuid, p_name text, p_plan text, p_address text, p_units integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare f public.organizations; o uuid; b uuid; l uuid;
begin
 select * into f from public.organizations where id=p_firm and kind='firm';
 if not found then raise exception 'forbidden'; end if;
 insert into public.organizations(name,created_by,kind,letterhead,signature_block,separation_of_duties)
 values(left(p_name,120),auth.uid(),'building',f.letterhead,f.signature_block,f.separation_of_duties) returning id into o;
 insert into public.buildings(org_id,name,strata_plan_no,address,unit_count) values(o,left(p_name,120),nullif(p_plan,''),coalesce(p_address,''),p_units) returning id into b;
 insert into public.firm_building_links(building_id,firm_org_id,status,invited_by,accepted_by,accepted_at) values(b,p_firm,'active',auth.uid(),auth.uid(),now()) returning id into l;
 perform private.add_link_members(l);
 update public.building_members set via_link_id = null where building_id = b and user_id = auth.uid();
 return b;
end; $$;

update public.building_members m
set via_link_id = null
from public.buildings b
join public.organizations o on o.id = b.org_id and o.kind = 'building'
where m.building_id = b.id
  and m.user_id = o.created_by
  and m.via_link_id is not null;
