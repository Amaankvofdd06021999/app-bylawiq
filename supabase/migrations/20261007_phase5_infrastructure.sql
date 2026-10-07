-- Phase 5 Infrastructure: Database schema for document approval, feature flags, and regional KBs

-- 1. Feature Flags table (for platform admin to toggle features)
create table if not exists public.feature_flags (
  id uuid default gen_random_uuid() primary key,
  flag_name text not null unique,
  enabled boolean not null default false,
  description text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid references auth.users(id)
);

comment on table public.feature_flags is 'Platform-wide feature toggles (residentAi, regionalKbs, etc.)';
create index idx_feature_flags_name on public.feature_flags(flag_name);

-- 2. Document status and approval workflow
alter table public.documents
add column if not exists status text default 'draft' not null check (status in ('draft', 'submitted', 'approved', 'sent', 'archived'));
alter table public.documents
add column if not exists owner_visible boolean default false not null;
alter table public.documents
add column if not exists submitted_by uuid references auth.users(id);
alter table public.documents
add column if not exists submitted_at timestamp with time zone;
alter table public.documents
add column if not exists approved_by uuid references auth.users(id);
alter table public.documents
add column if not exists approved_at timestamp with time zone;
alter table public.documents
add column if not exists sent_by uuid references auth.users(id);
alter table public.documents
add column if not exists sent_at timestamp with time zone;

comment on column public.documents.status is 'draft|submitted|approved|sent|archived';
comment on column public.documents.owner_visible is 'True if residents can see this document';
comment on column public.documents.approved_by is 'User who approved (separation of duties: != submitted_by)';

create index idx_documents_status on public.documents(status);
create index idx_documents_owner_visible on public.documents(owner_visible);
create index idx_documents_building_status on public.documents(building_id, status);

-- 3. Document review workflow (comments and change requests)
create table if not exists public.document_reviews (
  id uuid default gen_random_uuid() primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  building_id uuid not null references public.buildings(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'changes_requested')) default 'pending',
  comment text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.document_reviews is 'Track document approvals by firm owner (separation of duties)';
create index idx_document_reviews_document on public.document_reviews(document_id);
create index idx_document_reviews_building on public.document_reviews(building_id);
create index idx_document_reviews_status on public.document_reviews(status);
create index idx_document_reviews_reviewer on public.document_reviews(reviewer_id);

-- Enable RLS on document_reviews
alter table public.document_reviews enable row level security;

-- RLS: Users can see reviews for their building/org
create policy "Users can read reviews for their building"
  on public.document_reviews
  for select
  using (
    building_id in (
      select building_id from public.building_members where user_id = auth.uid() and deleted_at is null
    )
    or building_id in (
      select building_id from public.org_members
      join public.building_links on org_members.org_id = building_links.org_id
      where org_members.user_id = auth.uid() and org_members.deleted_at is null
    )
  );

-- RLS: Only firm owner can create/update reviews
create policy "Firm owner can review documents"
  on public.document_reviews
  for insert
  with check (
    exists (
      select 1 from public.org_members
      where org_members.user_id = auth.uid()
      and org_members.role = 'org_owner'
      and org_members.deleted_at is null
    )
  );

-- 4. Firm knowledge base (internal documents accessible to firm staff)
create table if not exists public.firm_knowledge (
  id uuid default gen_random_uuid() primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null,
  document_type text not null check (document_type in ('template', 'precedent', 'policy', 'procedure')),
  created_by uuid not null references auth.users(id),
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  deleted_at timestamp with time zone
);

comment on table public.firm_knowledge is 'Firm-internal documents (templates, precedents, policies)';
create index idx_firm_knowledge_org on public.firm_knowledge(org_id);
create index idx_firm_knowledge_type on public.firm_knowledge(document_type);
create index idx_firm_knowledge_deleted on public.firm_knowledge(deleted_at);

-- Enable RLS
alter table public.firm_knowledge enable row level security;

-- RLS: Org members can read
create policy "Org members can read firm knowledge"
  on public.firm_knowledge
  for select
  using (
    org_id in (
      select org_id from public.org_members where user_id = auth.uid() and deleted_at is null
    )
  );

-- 5. Regional knowledge bases (BC, AB, ON, QC, MB, SK)
create table if not exists public.regional_kbs (
  id uuid default gen_random_uuid() primary key,
  region text not null unique check (region in ('BC', 'AB', 'ON', 'QC', 'MB', 'SK', 'UNIVERSAL')),
  description text,
  building_count int default 0,
  last_updated timestamp with time zone default now()
);

comment on table public.regional_kbs is 'Regional knowledge bases (jurisdiction-specific legal info)';
insert into public.regional_kbs (region, description) values
  ('BC', 'British Columbia Strata Property Act & decisions'),
  ('AB', 'Alberta Condominium Act'),
  ('ON', 'Ontario Condominium Act'),
  ('QC', 'Quebec Co-ownership Law'),
  ('MB', 'Manitoba Condominium Act'),
  ('SK', 'Saskatchewan Condominium Act'),
  ('UNIVERSAL', 'Cross-jurisdiction precedents & common law')
on conflict (region) do nothing;

-- 6. Regional KB passages (searchable content)
create table if not exists public.kb_passages (
  id uuid default gen_random_uuid() primary key,
  kb_id uuid not null references public.regional_kbs(id) on delete cascade,
  title text not null,
  content text not null,
  source_url text,
  relevance_score float default 0.5,
  embedding vector(1536),
  created_at timestamp with time zone default now()
);

comment on table public.kb_passages is 'Searchable passages in regional KBs';
create index idx_kb_passages_kb on public.kb_passages(kb_id);
create index idx_kb_passages_embedding on public.kb_passages using ivfflat (embedding vector_cosine_ops);

-- 7. Building to region mapping
alter table public.buildings
add column if not exists region text check (region in ('BC', 'AB', 'ON', 'QC', 'MB', 'SK'));

comment on column public.buildings.region is 'Which region the building is in (for regional KB access)';
create index idx_buildings_region on public.buildings(region);

-- 8. Resident management (who can access the building)
alter table public.building_members
add column if not exists unit_number text,
add column if not exists join_code_used text;

comment on column public.building_members.unit_number is 'Resident unit number (if applicable)';
comment on column public.building_members.join_code_used is 'Join code resident used to enter building';

-- 9. Audit trail for approvals (who approved what and when)
alter table public.document_reviews
add column if not exists changes_requested_count int default 0;

-- 10. Platform admin audit log (all admin actions)
create table if not exists public.platform_admin_audit (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid not null references auth.users(id),
  action text not null,
  resource_type text not null,
  resource_id uuid,
  details jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

comment on table public.platform_admin_audit is 'Immutable log of all platform admin actions';
create index idx_admin_audit_admin on public.platform_admin_audit(admin_id);
create index idx_admin_audit_action on public.platform_admin_audit(action);
create index idx_admin_audit_created on public.platform_admin_audit(created_at desc);

-- 11. Dispute visibility scoping (residents can see disputes affecting their unit)
alter table public.disputes
add column if not exists is_public boolean default false,
add column if not exists visible_to_residents boolean default false;

comment on column public.disputes.is_public is 'Publicly visible dispute (affects community, not individual unit)';
comment on column public.disputes.visible_to_residents is 'Residents can see this dispute';

-- Indexes for performance
create index idx_disputes_public on public.disputes(is_public);
create index idx_disputes_visible_to_residents on public.disputes(visible_to_residents);
