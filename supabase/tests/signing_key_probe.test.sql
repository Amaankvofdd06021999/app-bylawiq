-- The readiness probe: true only for a signature made with the database's stored signing key, and callable by the service
-- role only. Nothing here reads or prints the key itself.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(5);

select is(
  public.signing_key_matches('bylawiq-signing-probe-v1',
    encode(extensions.hmac('bylawiq-signing-probe-v1',
      (select value from private.runtime_secrets where name = 'server_signing'), 'sha256'), 'hex')),
  true,
  'a signature made with the stored key verifies');

select is(
  public.signing_key_matches('bylawiq-signing-probe-v1',
    encode(extensions.hmac('bylawiq-signing-probe-v1', 'not-the-stored-key', 'sha256'), 'hex')),
  false,
  'a signature made with a different key does not verify');

select is(public.signing_key_matches('bylawiq-signing-probe-v1', null), null,
  'a missing signature does not verify');

select ok(not has_function_privilege('anon', 'public.signing_key_matches(text,text)', 'execute'),
  'anon cannot call the probe');
select ok(not has_function_privilege('authenticated', 'public.signing_key_matches(text,text)', 'execute'),
  'signed-in users cannot call the probe');

select * from finish();
rollback;
