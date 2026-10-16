-- Firm knowledge: publish a document to the firm's library. The owner or an admin of the firm publishes a document and
-- its paragraph chunks in one call, so a document never exists without its searchable text. Active members of the firm
-- can search it (search_firm_knowledge already checks membership). Other firms cannot read it.
--
-- Rollback: drop function public.publish_firm_document(uuid, text, text, text);

create or replace function public.publish_firm_document(p_firm uuid, p_title text, p_kind text, p_text text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id uuid;
  v_title text := trim(coalesce(p_title, ''));
  v_text text := coalesce(p_text, '');
begin
  if not exists (
    select 1 from public.org_members m
    where m.org_id = p_firm and m.user_id = (select auth.uid())
      and m.role in ('org_owner', 'org_admin') and m.status = 'active'
  ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_kind not in ('template', 'policy', 'precedent', 'research', 'guide') then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if length(v_title) < 1 or length(v_title) > 180 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  if length(trim(v_text)) < 20 or length(v_text) > 200000 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  insert into public.firm_documents (firm_id, title, doc_kind, content_hash, created_by, published_at)
  values (p_firm, v_title, p_kind, encode(extensions.digest(v_text, 'sha256'), 'hex'), (select auth.uid()), now())
  returning id into v_id;

  insert into public.firm_document_chunks (document_id, firm_id, chunk_index, content)
  select v_id, p_firm, t.n - 1, trim(t.c)
  from regexp_split_to_table(v_text, E'\\n\\s*\\n') with ordinality as t(c, n)
  where length(trim(t.c)) > 0;

  return v_id;
end;
$$;

revoke all on function public.publish_firm_document(uuid, text, text, text) from public, anon;
grant execute on function public.publish_firm_document(uuid, text, text, text) to authenticated;
