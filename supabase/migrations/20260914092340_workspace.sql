create table public.knowledge_bases (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
 name text not null, description text not null default '', created_at timestamptz not null default now(), deleted_at timestamptz, unique(id,building_id)
);
create table public.documents (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
 knowledge_base_id uuid, title text not null, type text not null default 'other', source_url text,
 storage_path text, uploaded_by uuid not null references auth.users(id), status text not null default 'uploaded'
 check(status in ('uploaded','scanning','parsing','chunking','embedding','review','ready','failed')),
 error_message text, effective_date date, effective_until date, lto_filing_ref text,
 content_hash text, parsed_sections jsonb, structure_confirmed boolean not null default false,
 owner_visible boolean not null default false, byte_size integer not null default 0,
 superseded_by uuid, created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,building_id), foreign key(knowledge_base_id,building_id) references public.knowledge_bases(id,building_id),
 foreign key(superseded_by,building_id) references public.documents(id,building_id),
 check(effective_until is null or effective_date is null or effective_until>effective_date)
);
create index documents_scope_idx on public.documents(building_id,status) where deleted_at is null;
create table public.document_versions (
 id uuid primary key default gen_random_uuid(), document_id uuid not null, building_id uuid not null,
 content_hash text not null, storage_path text, created_at timestamptz not null default now(),
 unique(document_id,content_hash), foreign key(document_id,building_id) references public.documents(id,building_id)
);
-- Voyage law-2 produces 1024 dimensions. Keep provider, model and dimensions immutable together.
create table public.document_chunks (
 id uuid primary key default gen_random_uuid(), document_id uuid not null, building_id uuid not null,
 chunk_index integer not null, content text not null, heading text, section_ref text, page_from integer,
 effective_date date, embedding public.vector(1024) not null,
 embedding_model text not null default 'voyage-law-2' check(embedding_model='voyage-law-2'),
 tsv tsvector generated always as (to_tsvector('english',content)) stored,
 created_at timestamptz not null default now(), unique(document_id,chunk_index),
 foreign key(document_id,building_id) references public.documents(id,building_id)
);
create index chunks_vector_idx on public.document_chunks using hnsw(embedding public.vector_cosine_ops);
create index chunks_text_idx on public.document_chunks using gin(tsv);
create index chunks_scope_idx on public.document_chunks(building_id);
create table public.jurisdictions (
 id uuid primary key default gen_random_uuid(), name text not null, level text not null, code text not null unique,
 coverage text not null default 'none' check(coverage in ('full','partial','linked','none')), source_url text, last_synced_at timestamptz
);
create table public.legal_sources (
 id uuid primary key default gen_random_uuid(), jurisdiction_id uuid references public.jurisdictions(id),
 type text not null, title text not null, citation text not null, url text, in_force_from date,
 in_force_to date, verified_at timestamptz, corpus_version integer not null default 1
);
create table public.legal_chunks (
 id uuid primary key default gen_random_uuid(), source_id uuid not null references public.legal_sources(id),
 content text not null, section_ref text, heading text, embedding public.vector(1024) not null,
 tsv tsvector generated always as (to_tsvector('english',content)) stored
);
create index legal_vector_idx on public.legal_chunks using hnsw(embedding public.vector_cosine_ops);
create index legal_text_idx on public.legal_chunks using gin(tsv);
create index legal_source_idx on public.legal_chunks(source_id);

create table public.agents (
 id uuid primary key default gen_random_uuid(), building_id uuid not null references public.buildings(id),
 name text not null, description text not null default '', instructions text not null default '',
 knowledge_base_id uuid, include_legal boolean not null default true, top_k integer not null default 8 check(top_k between 3 and 10),
 status text not null default 'draft' check(status in ('draft','deployed','paused')),
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), deleted_at timestamptz,
 unique(id,building_id), foreign key(knowledge_base_id,building_id) references public.knowledge_bases(id,building_id)
);
create table public.agent_deployments (
 id uuid primary key default gen_random_uuid(), agent_id uuid not null, building_id uuid not null,
 version integer not null, config jsonb not null, deployed_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(), unique(agent_id,version), unique(id,building_id),
 foreign key(agent_id,building_id) references public.agents(id,building_id)
);
create table public.chats (
 id uuid primary key default gen_random_uuid(), building_id uuid references public.buildings(id),
 user_id uuid not null references auth.users(id), title text not null default 'New conversation',
 scope text not null default 'building' check(scope in ('building','general','portfolio')),
 scope_building_ids uuid[] not null default '{}', as_of date, source_types text[] not null default '{}',
 agent_deployment_id uuid, parent_chat_id uuid references public.chats(id),
 archived boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((scope='general' and building_id is null and cardinality(scope_building_ids)=0 and agent_deployment_id is null) or (scope<>'general' and building_id is not null)),
 check(scope='portfolio' or cardinality(scope_building_ids)=0),
 foreign key(agent_deployment_id,building_id) references public.agent_deployments(id,building_id)
);
create index chats_owner_idx on public.chats(user_id,updated_at desc);
create table public.messages (
 id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats(id),
 role text not null check(role in ('user','assistant')), parts jsonb not null, model text,
 created_at timestamptz not null default now(), unique(id,chat_id)
);
create index messages_chat_idx on public.messages(chat_id,created_at);
create table public.message_citations (
 id uuid primary key default gen_random_uuid(), message_id uuid not null references public.messages(id),
 ordinal integer not null, kind text not null check(kind in ('building','legal')),
 document_chunk_id uuid references public.document_chunks(id), legal_chunk_id uuid references public.legal_chunks(id),
 quoted_span text not null, unique(message_id,ordinal), check(num_nonnulls(document_chunk_id,legal_chunk_id)=1)
);
create index citations_message_idx on public.message_citations(message_id);
create table public.chat_runs (
 id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats(id),
 request_id uuid not null unique, status text not null default 'running' check(status in ('running','complete','failed','cancelled')),
 cancel_requested boolean not null default false, created_at timestamptz not null default now(), heartbeat_at timestamptz not null default now()
);
create unique index one_chat_run_idx on public.chat_runs(chat_id) where status='running';
create table public.stream_events (
 id bigint generated always as identity primary key, run_id uuid not null references public.chat_runs(id) on delete cascade,
 event jsonb not null, created_at timestamptz not null default now()
);
create index stream_run_idx on public.stream_events(run_id,id);
create table public.retrieval_traces (
 id uuid primary key default gen_random_uuid(), chat_id uuid not null references public.chats(id),
 message_id uuid references public.messages(id), candidate_ids uuid[] not null default '{}', used_ids uuid[] not null default '{}',
 corpus_versions jsonb not null default '{}', feedback text, created_at timestamptz not null default now()
);
create index traces_chat_idx on public.retrieval_traces(chat_id);
create function public.can_use_chat(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.chats c where c.id=p_id and c.user_id=auth.uid() and
 (c.scope='general' or (public.authorize('chat.use',c.building_id) and
 (c.scope<>'portfolio' or (cardinality(c.scope_building_ids)>0 and not exists(select 1 from unnest(c.scope_building_ids) b where not public.authorize('chat.use_portfolio',b))))))); $$;
create function public.validate_chat() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.building_id is distinct from old.building_id or new.user_id<>old.user_id or new.scope<>old.scope or new.scope_building_ids<>old.scope_building_ids or new.agent_deployment_id is distinct from old.agent_deployment_id or new.as_of is distinct from old.as_of or new.source_types<>old.source_types) then raise exception 'immutable_chat_scope'; end if;
 if new.scope='portfolio' and (cardinality(new.scope_building_ids)<1 or exists(select 1 from unnest(new.scope_building_ids) b where not public.authorize('chat.use_portfolio',b))) then raise exception 'forbidden'; end if;
 if new.parent_chat_id is not null and not public.can_use_chat(new.parent_chat_id) then raise exception 'forbidden'; end if;
 return new;
end; $$;
create trigger validate_chat before insert or update on public.chats for each row execute function public.validate_chat();

-- Standard building-scoped resources: one live table-based permission check, not stale JWT claims.
do $$ declare t text; begin
 foreach t in array array['knowledge_bases','documents','document_versions','document_chunks','agents','agent_deployments'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create index %I on public.%I(building_id)',t||'_rls_idx',t);
 end loop;
end $$;
create policy kb_read on public.knowledge_bases for select to authenticated using(public.authorize('vault.read',building_id) and deleted_at is null);
create policy kb_insert on public.knowledge_bases for insert to authenticated with check(public.authorize('agent.manage',building_id));
create policy kb_update on public.knowledge_bases for update to authenticated using(public.authorize('agent.manage',building_id)) with check(public.authorize('agent.manage',building_id));
create policy docs_read on public.documents for select to authenticated using(public.authorize('vault.read',building_id) and deleted_at is null and (public.my_building_role(building_id)<>'owner_resident' or owner_visible));
create policy docs_insert on public.documents for insert to authenticated with check(public.authorize('vault.upload',building_id) and uploaded_by=auth.uid() and status='uploaded' and not structure_confirmed);
create policy docs_update on public.documents for update to authenticated using(public.authorize('vault.upload',building_id)) with check(public.authorize('vault.upload',building_id));
create policy versions_read on public.document_versions for select to authenticated using(exists(select 1 from public.documents d where d.id=document_id));
create policy chunks_read on public.document_chunks for select to authenticated using(public.authorize('chat.use',building_id) and exists(select 1 from public.documents d where d.id=document_id and d.status='ready' and (d.type<>'bylaws' or d.structure_confirmed)));
create policy agents_read on public.agents for select to authenticated using(public.authorize('chat.use',building_id) and deleted_at is null);
create policy agents_insert on public.agents for insert to authenticated with check(public.authorize('agent.manage',building_id) and created_by=auth.uid() and status='draft');
create policy agents_update on public.agents for update to authenticated using(public.authorize('agent.manage',building_id)) with check(public.authorize('agent.manage',building_id));
create policy deployments_read on public.agent_deployments for select to authenticated using(public.authorize('chat.use',building_id));

do $$ declare t text; begin
 foreach t in array array['jurisdictions','legal_sources','legal_chunks'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy shared_read on public.%I for select to authenticated using(true)',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
 foreach t in array array['chats','messages','message_citations','chat_runs','stream_events','retrieval_traces'] loop
  execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;
create policy chats_read on public.chats for select to authenticated using(user_id=auth.uid() and (scope='general' or public.authorize('chat.use',building_id)) and (scope<>'portfolio' or not exists(select 1 from unnest(scope_building_ids) b where not public.authorize('chat.use_portfolio',b))));
create policy chats_insert on public.chats for insert to authenticated with check(user_id=auth.uid() and (scope='general' or public.authorize('chat.use',building_id)));
create policy chats_update on public.chats for update to authenticated using(public.can_use_chat(id)) with check(public.can_use_chat(id));
create policy messages_read on public.messages for select to authenticated using(public.can_use_chat(chat_id));
create policy messages_insert on public.messages for insert to authenticated with check(public.can_use_chat(chat_id));
create policy citations_read on public.message_citations for select to authenticated using(exists(select 1 from public.messages m where m.id=message_id));
create policy citations_insert on public.message_citations for insert to authenticated with check(exists(select 1 from public.messages m where m.id=message_id) and ((kind='building' and exists(select 1 from public.document_chunks c where c.id=document_chunk_id and position(quoted_span in c.content)>0)) or (kind='legal' and exists(select 1 from public.legal_chunks c where c.id=legal_chunk_id and position(quoted_span in c.content)>0))));
create policy runs_read on public.chat_runs for select to authenticated using(public.can_use_chat(chat_id));
create policy runs_insert on public.chat_runs for insert to authenticated with check(public.can_use_chat(chat_id));
create policy runs_update on public.chat_runs for update to authenticated using(public.can_use_chat(chat_id)) with check(public.can_use_chat(chat_id));
create policy events_read on public.stream_events for select to authenticated using(exists(select 1 from public.chat_runs r where r.id=run_id));
create policy events_insert on public.stream_events for insert to authenticated with check(exists(select 1 from public.chat_runs r where r.id=run_id));
create policy traces_read on public.retrieval_traces for select to authenticated using(public.can_use_chat(chat_id));
create policy traces_insert on public.retrieval_traces for insert to authenticated with check(public.can_use_chat(chat_id));
create policy traces_update on public.retrieval_traces for update to authenticated using(public.can_use_chat(chat_id));

grant select on public.knowledge_bases,public.documents,public.document_versions,public.document_chunks,public.agents,public.agent_deployments,public.chats,public.messages,public.message_citations,public.chat_runs,public.stream_events,public.retrieval_traces to authenticated;
grant insert on public.knowledge_bases,public.documents,public.agents,public.chats,public.messages,public.message_citations,public.chat_runs,public.stream_events,public.retrieval_traces to authenticated;
grant update(name,description,deleted_at) on public.knowledge_bases to authenticated;
grant update(title,type,effective_date,lto_filing_ref,knowledge_base_id,owner_visible) on public.documents to authenticated;
grant update(name,description,instructions,knowledge_base_id,include_legal,top_k,deleted_at) on public.agents to authenticated;
grant update(title,archived,updated_at) on public.chats to authenticated;
grant update(status,cancel_requested,heartbeat_at) on public.chat_runs to authenticated;
grant update(feedback) on public.retrieval_traces to authenticated;
grant usage on sequence public.stream_events_id_seq to authenticated;

create function public.deploy_agent(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.agents; d uuid; v integer;
begin
 select * into a from public.agents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('agent.deploy',a.building_id) then raise exception 'forbidden'; end if;
 if not exists(select 1 from public.documents where building_id=a.building_id and (a.knowledge_base_id is null or knowledge_base_id=a.knowledge_base_id) and status='ready' and deleted_at is null) then raise exception 'knowledge_not_ready'; end if;
 select coalesce(max(version),0)+1 into v from public.agent_deployments where agent_id=p_id;
 insert into public.agent_deployments(agent_id,building_id,version,config,deployed_by) values(p_id,a.building_id,v,jsonb_build_object('name',a.name,'instructions',a.instructions,'knowledge_base_id',a.knowledge_base_id,'include_legal',a.include_legal,'top_k',a.top_k),auth.uid()) returning id into d;
 update public.agents set status='deployed' where id=p_id;
 return d;
end; $$;
create function public.delete_document(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare b uuid; begin
 select building_id into b from public.documents where id=p_id and deleted_at is null;
 if not public.authorize('vault.delete',b) then raise exception 'forbidden'; end if;
 update public.documents set deleted_at=now() where id=p_id;
 update public.buildings set corpus_version=corpus_version+1 where id=b;
end; $$;
do $$ declare t text; begin
 foreach t in array array['knowledge_bases','documents','agents','agent_deployments'] loop
  execute format('create trigger audit_resource after insert or update on public.%I for each row execute function public.audit_change()',t);
 end loop;
end $$;
revoke all on function public.deploy_agent(uuid),public.delete_document(uuid) from public,anon;
grant execute on function public.deploy_agent(uuid),public.delete_document(uuid) to authenticated;
