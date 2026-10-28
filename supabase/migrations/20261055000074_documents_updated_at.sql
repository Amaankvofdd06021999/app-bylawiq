-- Migration 74: Add updated_at column, index, and trigger to public.documents
-- Supports staleness leasing and stranded job recovery for background document ingestion.

alter table public.documents
  add column if not exists updated_at timestamptz not null default now();

create index if not exists documents_updated_at_idx
  on public.documents(updated_at);

create or replace function public.set_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
  before update on public.documents
  for each row execute function public.set_documents_updated_at();

grant select, update(updated_at) on public.documents to authenticated;
grant select, update(updated_at) on public.documents to service_role;
