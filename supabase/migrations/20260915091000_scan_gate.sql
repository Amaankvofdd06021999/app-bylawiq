-- Stored files must not be readable until the malware scan clears them. Upload writes the file to storage
-- before ingestion scans it, and document status is set to 'parsing' both before and after the scan, so status
-- cannot tell a scanned file from an unscanned one. Ingestion (service role) sets this timestamp instead.
alter table public.documents add column scan_cleared_at timestamptz;
drop policy vault_read on storage.objects;
create policy vault_read on storage.objects for select to authenticated using(bucket_id='vault' and exists(select 1 from public.documents d where d.storage_path=name and d.deleted_at is null and d.scan_cleared_at is not null));
-- Members insert documents directly; they must not be able to pre-clear their own upload. Column update grants already exclude it.
drop policy docs_insert on public.documents;
create policy docs_insert on public.documents for insert to authenticated with check(public.authorize('vault.upload',building_id) and uploaded_by=auth.uid() and status='uploaded' and not structure_confirmed and scan_cleared_at is null);
