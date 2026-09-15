-- Used inside a transaction by the pgTAP suite. Fictional test identities only.
insert into auth.users(id,email,email_confirmed_at) values
 ('90000000-0000-4000-8000-000000000001','rls-a@example.invalid',now()),
 ('90000000-0000-4000-8000-000000000002','rls-b@example.invalid',now());
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
select public.bootstrap_workspace('RLS org A','admin','RLS building A','RLS A');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
select public.bootstrap_workspace('RLS org B','admin','RLS building B','RLS B');
