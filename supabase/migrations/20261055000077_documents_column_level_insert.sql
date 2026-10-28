-- Migration 77: Restrict authenticated INSERT to authorized upload columns only
-- Revoking table-level INSERT from authenticated and granting only client-writable
-- columns ensures updated_at cannot be supplied on client inserts and is always
-- populated by default now().

revoke insert on public.documents from authenticated;

grant insert (
  id,
  building_id,
  knowledge_base_id,
  title,
  type,
  source_url,
  storage_path,
  uploaded_by,
  status,
  error_message,
  effective_date,
  effective_until,
  lto_filing_ref,
  content_hash,
  byte_size,
  submitted_by,
  submitted_at
) on public.documents to authenticated;
