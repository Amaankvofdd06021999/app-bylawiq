-- row_number() is bigint, but the function declares ranking as integer, so the call failed at run time.
-- The ranking is cast to integer. Rollback: drop the ::int cast.
CREATE OR REPLACE FUNCTION public.compare_building_spending(p_building_ids uuid[], p_month date DEFAULT (CURRENT_DATE - '1 mon'::interval))
 RETURNS TABLE(building_id uuid, building_name text, residents_active integer, questions_asked integer, total_spent_usd numeric, avg_spend_per_resident numeric, ranking integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_month date;
begin
  if exists (select 1 from unnest(p_building_ids) as x(id) where not public.authorize('chat.use', x.id)) then raise insufficient_privilege using message = 'forbidden'; end if;
  v_month := date_trunc('month', p_month)::date;

  return query
  select
    bs.building_id,
    b.name,
    bs.residents_active,
    bs.questions_asked,
    bs.total_spent_usd,
    case
      when bs.residents_active > 0 then bs.total_spent_usd / bs.residents_active
      else 0
    end as avg_spend_per_resident,
    row_number() over (order by bs.total_spent_usd desc)::int as ranking
  from public.building_spending bs
  join public.buildings b on b.id = bs.building_id
  where bs.building_id = any(p_building_ids)
    and bs.month = v_month
  order by bs.total_spent_usd desc;
end; $function$;
