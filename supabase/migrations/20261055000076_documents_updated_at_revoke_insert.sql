-- Migration 76: Enforce strict read-only access on documents.updated_at
-- The before-update trigger manages updated_at automatically; authenticated clients do not need direct INSERT.

revoke insert (updated_at) on public.documents from authenticated;
