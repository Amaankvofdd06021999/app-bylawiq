-- Migration 75: Enforce least privilege on public.documents(updated_at)
-- The before-update trigger manages updated_at automatically; authenticated clients do not need direct UPDATE.

revoke update (updated_at) on public.documents from authenticated;
