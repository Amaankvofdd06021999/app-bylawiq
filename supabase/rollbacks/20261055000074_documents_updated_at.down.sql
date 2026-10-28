-- Rollback Migration 74: Revert updated_at column, index, and trigger on public.documents

drop trigger if exists set_documents_updated_at on public.documents;
drop function if exists public.set_documents_updated_at();
drop index if exists public.documents_updated_at_idx;
alter table public.documents drop column if exists updated_at;
