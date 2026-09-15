create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.runtime_secrets(name text primary key,value text not null);
alter table private.runtime_secrets enable row level security;
insert into private.runtime_secrets(name,value) values('server_signing',encode(extensions.gen_random_bytes(32),'hex'));
create table private.rate_limits(key text not null,occurred_at timestamptz not null default now());
create index rate_limits_key_idx on private.rate_limits(key,occurred_at);
alter table private.rate_limits enable row level security;
create function private.valid_signature(p_payload text,p_signature text) returns boolean language sql stable security definer set search_path='' as $$
 select encode(extensions.hmac(p_payload,value,'sha256'),'hex')=p_signature from private.runtime_secrets where name='server_signing'; $$;
create function public.consume_rate_limit(p_key text,p_limit integer,p_window integer,p_signature text) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not private.valid_signature(p_key||':'||p_limit||':'||p_window,p_signature) then raise exception 'forbidden'; end if;
 perform pg_advisory_xact_lock(hashtext(p_key));
 delete from private.rate_limits where key=p_key and occurred_at<now()-make_interval(secs=>p_window);
 select count(*) into n from private.rate_limits where key=p_key;
 if n>=p_limit then return false; end if;
 insert into private.rate_limits(key) values(p_key);return true;
end; $$;
-- The caller still supplies an authenticated JWT; a server HMAC attests provenance without bypassing RLS on reads.
create function public.append_verified_message(p_chat uuid,p_id uuid,p_parts text,p_model text,p_signature text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.can_use_chat(p_chat) or not private.valid_signature(p_chat::text||':'||p_id::text||':'||p_parts,p_signature) then raise exception 'forbidden'; end if;
 insert into public.messages(id,chat_id,role,parts,model) values(p_id,p_chat,'assistant',p_parts::jsonb,p_model);
end; $$;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated with check(public.can_use_chat(chat_id) and role='user' and model is null and jsonb_array_length(parts)>0);
create function public.branch_chat(p_chat uuid,p_message uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.chats; cutoff timestamptz; new_chat uuid;
begin
 if not public.can_use_chat(p_chat) then raise exception 'forbidden'; end if;
 select * into c from public.chats where id=p_chat;
 select created_at into cutoff from public.messages where id=p_message and chat_id=p_chat and role='user';
 if cutoff is null then raise exception 'not_found'; end if;
 insert into public.chats(building_id,user_id,title,scope,scope_building_ids,as_of,source_types,agent_deployment_id,parent_chat_id)
 values(c.building_id,auth.uid(),c.title||' · branch',c.scope,c.scope_building_ids,c.as_of,c.source_types,c.agent_deployment_id,c.id) returning id into new_chat;
 insert into public.messages(chat_id,role,parts,model,created_at) select new_chat,role,parts,model,created_at from public.messages where chat_id=p_chat and created_at<cutoff order by created_at;
 return new_chat;
end; $$;

-- Explicit grants also override older Supabase default privileges. Column grants would otherwise be ineffective.
revoke all on all tables in schema public from anon,authenticated;
revoke all on all sequences in schema public from anon,authenticated;
grant select on public.profiles,public.organizations,public.org_members,public.buildings,public.building_members,public.role_permissions,public.audit_log,public.knowledge_bases,public.documents,public.document_versions,public.document_chunks,public.agents,public.agent_deployments,public.chats,public.messages,public.message_citations,public.chat_runs,public.stream_events,public.retrieval_traces,public.jurisdictions,public.legal_sources,public.legal_chunks,public.bylaw_sets,public.bylaw_nodes,public.bylaw_versions,public.bylaw_comments,public.disputes,public.dispute_events,public.generated_documents,public.artifact_versions,public.notifications to authenticated;
grant select(id,building_id,email,role,expires_at,accepted_at,revoked_at,created_at) on public.invitations to authenticated;
grant insert on public.knowledge_bases,public.documents,public.agents,public.chats,public.messages,public.message_citations,public.chat_runs,public.stream_events,public.retrieval_traces,public.bylaw_comments,public.disputes,public.generated_documents to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant update(name,letterhead,signature_block) on public.organizations to authenticated;
grant update(name,address,unit_count,fiscal_year_end,municipality) on public.buildings to authenticated;
grant update(name,description,deleted_at) on public.knowledge_bases to authenticated;
grant update(title,type,effective_date,lto_filing_ref,knowledge_base_id,owner_visible) on public.documents to authenticated;
grant update(name,description,instructions,knowledge_base_id,include_legal,top_k,deleted_at) on public.agents to authenticated;
grant update(title,archived,updated_at) on public.chats to authenticated;
grant update(status,cancel_requested,heartbeat_at) on public.chat_runs to authenticated;
grant update(feedback) on public.retrieval_traces to authenticated;
grant update(title,category,subject_unit,deleted_at) on public.disputes to authenticated;
grant usage on sequence public.stream_events_id_seq to authenticated;
revoke execute on all functions in schema public from public,anon;
grant execute on function public.is_org_member(uuid),public.is_org_admin(uuid),public.has_building_access(uuid),public.authorize(text,uuid),public.my_building_role(uuid),public.can_use_chat(uuid),public.can_assign(uuid,public.app_role),public.bootstrap_workspace(text,public.account_type,text,text),public.create_building(uuid,text,text,text,integer),public.archive_building(uuid),public.deploy_agent(uuid),public.delete_document(uuid),public.save_artifact(uuid,text,text),public.transition_artifact(uuid,text,timestamptz),public.log_dispute_event(uuid,text,timestamptz,text,uuid),public.save_bylaw(uuid,uuid,text,text,text,text),public.transition_bylaw(uuid,text,text,text,date,integer,integer,integer,text),public.update_notification(uuid,text,text,date),public.create_invitation(uuid,text,public.app_role,text,timestamptz),public.accept_invitation(text),public.change_membership(uuid,public.app_role,boolean),public.revoke_invitation(uuid),public.confirm_document_structure(uuid),public.append_verified_message(uuid,uuid,text,text,text),public.branch_chat(uuid,uuid),public.hybrid_search_building(uuid,text,public.vector,uuid,date,text[],integer),public.hybrid_search_legal(text,public.vector,uuid[],date,integer) to authenticated;
grant execute on function public.consume_rate_limit(text,integer,integer,text) to anon,authenticated;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant execute on all functions in schema public to service_role;
