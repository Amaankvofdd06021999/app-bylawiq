-- supabase/migrations/20261008_access_token_hook.sql
-- Postgres implementation of Supabase custom access token hook
--
-- This hook function is triggered by Supabase Auth when issuing/refreshing tokens.
-- It adds session_role + session_building_id claims to the JWT.
--
-- Deploy: Set this as the custom access token hook in Supabase Auth â†’ Providers â†’ Supabase
-- CLI: supabase secrets set CUSTOM_ACCESS_TOKEN_HOOK_FUNCTION=public.custom_access_token_hook
--
-- Behavior:
-- 1. Fetch all building_members rows for the user
-- 2. If none, return null claims (user has no building access)
-- 3. If 1, use that building/role
-- 4. If 2+, pick the "preferred" one (highest permission, or last-used from audit log)
-- 5. Inject claims into JWT

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  user_id uuid;
  memberships record;
  preferred_building_id uuid;
  preferred_role public.app_role;
  accessible_ids uuid[];
  result jsonb;
begin
  -- Extract user ID from event
  user_id := (event ->> 'user_id')::uuid;
  if user_id is null then
    return event;
  end if;

  -- Fetch all active building memberships for this user
  -- Order by permission level (staff first) and name
  select array_agg(building_id) into accessible_ids
  from public.building_members
  where user_id = $1
    and status = 'active'
    and (expires_at is null or expires_at > now());

  -- If no building access, return empty session claims
  if accessible_ids is null or array_length(accessible_ids, 1) is null then
    result := event;
    result := jsonb_set(result, '{custom_claims,session_role}', 'null'::jsonb);
    result := jsonb_set(result, '{custom_claims,session_building_id}', 'null'::jsonb);
    result := jsonb_set(result, '{custom_claims,accessible_building_ids}', '[]'::jsonb);
    return result;
  end if;

  -- Pick preferred building/role
  -- Priority: 1) Highest permission role, 2) First building alphabetically
  select building_id, role into preferred_building_id, preferred_role
  from public.building_members
  where user_id = $1
    and status = 'active'
    and (expires_at is null or expires_at > now())
    and building_id = any(accessible_ids)
  order by
    case role
      when 'org_owner'::public.app_role then 1
      when 'org_admin'::public.app_role then 2
      when 'portfolio_manager'::public.app_role then 3
      when 'portfolio_assistant'::public.app_role then 4
      when 'building_manager'::public.app_role then 5
      when 'council_president'::public.app_role then 6
      when 'council_member'::public.app_role then 7
      when 'external_counsel'::public.app_role then 8
      when 'owner_resident'::public.app_role then 9
      else 10
    end,
    (select name from public.buildings where id = building_members.building_id)
  limit 1;

  -- If no preferred building found (shouldn't happen), use first accessible
  if preferred_building_id is null then
    preferred_building_id := accessible_ids[1];

    -- Get role for first accessible building
    select role into preferred_role
    from public.building_members
    where building_id = preferred_building_id
      and user_id = $1
      and status = 'active'
    limit 1;
  end if;

  -- Build result with session claims
  result := event;
  result := jsonb_set(result, '{custom_claims,session_role}', to_jsonb(preferred_role::text));
  result := jsonb_set(result, '{custom_claims,session_building_id}', to_jsonb(preferred_building_id::text));
  result := jsonb_set(result, '{custom_claims,accessible_building_ids}', to_jsonb(accessible_ids));

  return result;
end;
$$;

comment on function public.custom_access_token_hook is 'Supabase custom access token hook: injects session claims into JWT on login/refresh';

-- Grant execution to authenticator role (the Supabase Auth service uses this)
grant execute on function public.custom_access_token_hook(jsonb) to authenticated;

-- Mark this function as the custom access token hook
-- Note: This is metadata only. Actual deployment requires setting it in Supabase dashboard:
-- Auth â†’ Providers â†’ Supabase â†’ Custom Access Token Hook
-- Function name: public.custom_access_token_hook
-- Input: jsonb, Output: jsonb
