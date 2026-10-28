-- Rollback Migration 72: Drop quarantine archive table
drop table if exists public.legal_sources_quarantine_log cascade;
