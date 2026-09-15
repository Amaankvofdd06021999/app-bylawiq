begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);
insert into auth.users(id,email,email_confirmed_at) values
 ('90000000-0000-4000-8000-000000000001','rls-a@example.invalid',now()),
 ('90000000-0000-4000-8000-000000000002','rls-b@example.invalid',now());
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select public.bootstrap_workspace('RLS org A','admin','RLS building A','RLS A');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select public.bootstrap_workspace('RLS org B','admin','RLS building B','RLS B');
select set_config('test.building_b',(select id::text from public.buildings where name='RLS building B'),true);
set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select is((select count(*)::integer from public.buildings where id=current_setting('test.building_b')::uuid),0,'known foreign building UUID returns no rows');
select is((select count(*)::integer from public.building_members where building_id=current_setting('test.building_b')::uuid),0,'foreign memberships are hidden');
select is(public.has_building_access(current_setting('test.building_b')::uuid),false,'foreign building access helper denies');
select is(public.authorize('vault.read',current_setting('test.building_b')::uuid),false,'foreign vault permission denies');
select is(public.authorize('chat.use',current_setting('test.building_b')::uuid),false,'foreign chat permission denies');
reset role;
select is((select count(*)::integer from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),0,'all public tables enable RLS');
select is((select count(*)::integer from pg_proc where proname in ('hybrid_search_building','hybrid_search_legal') and prosecdef),0,'retrieval is security invoker');
select is(has_table_privilege('authenticated','public.generated_documents','UPDATE'),false,'direct notice status mutation is denied');
select * from finish();
rollback;
