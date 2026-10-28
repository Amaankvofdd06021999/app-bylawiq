-- Rollback Migration 76: Re-grant INSERT on public.documents(updated_at) to authenticated

grant insert (updated_at) on public.documents to authenticated;
