-- Lets the API embed a submitter's profile: PostgREST cannot embed auth.users, but it can follow a profiles foreign key.
-- Added not valid so existing rows are not scanned at deploy time; every signed-up user has a profile row, so
-- `validate constraint` can run afterwards. Rollback: alter table public.documents drop constraint documents_submitted_by_profile_fkey;
alter table public.documents
  add constraint documents_submitted_by_profile_fkey
  foreign key (submitted_by) references public.profiles(id) not valid;
