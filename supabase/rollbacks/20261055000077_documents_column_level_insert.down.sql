-- Rollback Migration 77: Re-grant table-level INSERT on public.documents to authenticated

grant insert on public.documents to authenticated;
