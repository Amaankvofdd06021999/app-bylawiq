-- Readiness probe for the trusted-message signing key. The app signs a fixed probe with SERVER_SIGNING_SECRET and asks
-- the database whether that signature verifies with the key it stores. It returns only true or false, so neither side
-- reveals the key. Callable by the service role only.
--
-- Rollback: drop function public.signing_key_matches(text, text);

create or replace function public.signing_key_matches(p_probe text, p_signature text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select private.valid_signature(p_probe, p_signature);
$$;

revoke all on function public.signing_key_matches(text, text) from public, anon, authenticated;
grant execute on function public.signing_key_matches(text, text) to service_role;
