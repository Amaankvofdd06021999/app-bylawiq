-- A linked firm member who is reviewing a notice is read-only: they approve or request changes, they do not rewrite
-- what they are approving. The building's own edits still withdraw a document from firm review, as before.
-- Rollback: recreate public.save_artifact from 20260927093000_firm_review.sql (the body without the first check).

create or replace function public.save_artifact(p_id uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','pending_review','changes_requested') then raise exception 'immutable_approved_document'; end if;
 if d.status='pending_review' and d.review_by='firm' and private.is_linked_member(d.building_id) then raise exception 'firm_review_pending'; end if;
 insert into public.artifact_versions(building_id,artifact_id,body_md,edited_by) values(d.building_id,d.id,d.body_md,auth.uid());
 if d.status='pending_review' and d.review_by='firm' then
  insert into public.document_review_comments(document_id,building_id,author_id,body) values(d.id,d.building_id,auth.uid(),'This draft was edited, which withdrew it from strata management review.');
 end if;
 update public.generated_documents set title=p_title,body_md=p_body,status='draft',review_by='building',updated_at=now() where id=p_id;
end; $$;
