-- Rollback Migration 75: Re-grant UPDATE on public.documents(updated_at) to authenticated

grant update (updated_at) on public.documents to authenticated;
