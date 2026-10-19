'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, errorMessage } from '@/lib/errors';

/**
 * Firm knowledge: publish a document into the firm's library, and search it. Both run through the caller's client, so
 * the database decides: publishing needs an owner or admin of that firm; searching needs active membership of it.
 */

const PublishSchema = z.object({
  firmId: z.uuid(),
  title: z.string().trim().min(1).max(180),
  kind: z.enum(['template', 'policy', 'precedent', 'research', 'guide']),
  text: z.string().min(20).max(200_000),
});
const SearchSchema = z.object({
  firmId: z.uuid(),
  query: z.string().trim().min(2).max(200),
});

export type Published = { ok: true; id: string } | { ok: false; error: string };
export type SearchHit = { documentId: string; title: string; kind: string; content: string };
export type SearchResult = { ok: true; hits: SearchHit[] } | { ok: false; error: string };

export async function publishFirmDocumentAction(raw: unknown): Promise<Published> {
  try {
    const user = await requireUser();
    const input = PublishSchema.parse(raw);
    const { data, error } = await user.client.rpc('publish_firm_document', {
      p_firm: input.firmId,
      p_title: input.title,
      p_kind: input.kind,
      p_text: input.text,
    });
    checkDb(error);
    revalidatePath('/workspace');
    return { ok: true, id: z.uuid().parse(data) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function searchFirmKnowledgeAction(raw: unknown): Promise<SearchResult> {
  try {
    const user = await requireUser();
    const input = SearchSchema.parse(raw);
    const { data, error } = await user.client.rpc('search_firm_knowledge', {
      p_firm_id: input.firmId,
      p_query: input.query,
      p_limit: 10,
    });
    checkDb(error);
    const hits = z
      .array(
        z.object({
          document_id: z.uuid(),
          content: z.string(),
          kind: z.string(),
          title: z.string(),
        }),
      )
      .parse(data ?? []);
    return {
      ok: true,
      hits: hits.map((h) => ({
        documentId: h.document_id,
        title: h.title,
        kind: h.kind,
        content: h.content,
      })),
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

const SaveDocSchema = z.object({
  id: z.string().uuid().optional(),
  collection: z.enum(['templates', 'policies', 'guidance', 'legal_tracker']),
  title: z.string().trim().min(1).max(180),
  body: z.string().min(1).max(200_000),
});

export async function saveFirmDocAction(
  raw: unknown,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const input = SaveDocSchema.parse(raw);

    const { data: member } = await user.client
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('role', ['org_owner', 'org_admin', 'portfolio_manager'])
      .limit(1)
      .maybeSingle();

    if (!member) return { ok: false, error: 'You do not have permission to save firm knowledge.' };

    const kindMap: Record<string, 'template' | 'policy' | 'guide' | 'precedent'> = {
      templates: 'template',
      policies: 'policy',
      guidance: 'guide',
      legal_tracker: 'precedent',
    };

    const docKind = kindMap[input.collection] || 'guide';

    if (input.id) {
      const { error } = await user.client
        .from('firm_documents')
        .update({
          title: input.title,
          description: input.body,
          doc_kind: docKind,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .eq('firm_id', member.org_id);
      checkDb(error);
      revalidatePath('/workspace');
      return { ok: true, id: input.id };
    }

    const { data, error } = await user.client.rpc('publish_firm_document', {
      p_firm: member.org_id,
      p_title: input.title,
      p_kind: docKind,
      p_text: input.body,
    });
    checkDb(error);
    revalidatePath('/workspace');
    return { ok: true, id: z.uuid().parse(data) };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function deleteFirmDocAction(raw: {
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.uuid() }).parse(raw);
    const { error } = await user.client.from('firm_documents').delete().eq('id', id);
    checkDb(error);
    revalidatePath('/workspace');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
