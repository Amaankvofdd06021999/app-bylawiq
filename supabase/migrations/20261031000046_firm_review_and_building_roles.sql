-- Decisions D2 (link-scoped firm review), D13 (firm staff map to building_manager on linked buildings).
--
-- 1. Firm review gets its own permission, 'firm.review'. It is not a building role permission. authorize() answers
--    it from the firm relationship: the caller is an active member of the firm (owner, admin or portfolio manager)
--    and the building has an active link to that firm. building_manager does not gain review.act.
-- 2. decide_firm_review checks firm.review instead of review.act + linked membership.
-- 3. Firm staff joining a linked building become building_manager (portfolio_assistant stays portfolio_assistant).
--    Firm ownership stays at the firm organisation; it no longer grants org_owner powers (building deletion, billing)
--    on the building.
-- 4. Backfill: building memberships that are org_owner on a building-kind organisation become building_manager.
--    These are the golden manager's two rows. Firm org_members rows are unchanged.
--
-- Rollback: recreate authorize, decide_firm_review and add_link_members from their previous definitions
-- (20260927093000_firm_review.sql and 20260927092000_firm_link_codes.sql), and set the two backfilled building_members
-- rows back to org_owner (the rows are identifiable as building_manager on buildings whose organisation kind is
-- 'building' and that carry no via_link_id).

-- 1. Link-scoped firm-review check.
create or replace function private.is_firm_reviewer(p_building uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1
     from public.firm_building_links l
     join public.org_members m on m.org_id = l.firm_org_id
    where l.building_id = p_building
      and l.status = 'active'
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('org_owner','org_admin','portfolio_manager')
 ); $$;

create or replace function public.authorize(p_permission text, p_building uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select (p_permission = 'firm.review' and private.is_firm_reviewer(p_building))
     or exists(select 1 from public.building_members m join public.role_permissions p on p.role=m.role join public.buildings b on b.id=m.building_id
 where m.building_id=p_building and m.user_id=(select auth.uid()) and m.status='active' and (m.expires_at is null or m.expires_at>now()) and b.deleted_at is null and p.permission=p_permission); $$;

-- 2. Only firm-review decisions use the link-scoped check.
create or replace function public.decide_firm_review(p_id uuid, p_decision text, p_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; c text:=trim(coalesce(p_comment,''));
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('firm.review',d.building_id) then raise exception 'forbidden'; end if;
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

-- 3. Linked firm staff join as building_manager (portfolio_assistant stays portfolio_assistant).
create or replace function private.add_link_members(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.firm_building_links;
begin
 select * into l from public.firm_building_links where id=p_link and status='active';
 if not found then return; end if;
 insert into public.building_members(building_id,user_id,role,via_link_id)
 select l.building_id, m.user_id,
        case when m.role = 'portfolio_assistant' then 'portfolio_assistant'::public.app_role else 'building_manager'::public.app_role end,
        l.id
   from public.org_members m
  where m.org_id = l.firm_org_id and m.status = 'active'
    and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant')
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
 where public.building_members.via_link_id is not null;
end; $$;

-- 4. Backfill (M1). Only building-kind organisations: their org_owner rows came from the firm link, not from a building.
update public.building_members m
   set role = 'building_manager'
  from public.buildings b
  join public.organizations o on o.id = b.org_id and o.kind = 'building'
 where m.building_id = b.id
   and m.role = 'org_owner';
