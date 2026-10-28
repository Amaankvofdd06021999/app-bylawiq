import 'server-only';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { structuralChunks, contextualText } from '@/lib/ai/chunking';
import { checkDb, AppError } from '@/lib/errors';
import { NonRetriableError } from 'inngest';
import { inngest } from './client';
import { assertFileClean, scanConfigFrom } from '@/lib/security/file-scan';
import { assertTextLayer } from '@/lib/ai/text-layer';

// Step errors can arrive as plain objects, so an AppError is recognised by its shape. Its message is written for users.
function failureMessage(e: unknown): string {
  // Both fields: a database error has a code but no HTTP status, and its message must never reach the user.
  const coded =
    typeof e === 'object' &&
    e !== null &&
    typeof (e as { code?: unknown }).code === 'string' &&
    typeof (e as { status?: unknown }).status === 'number';
  const message = typeof e === 'object' && e !== null ? (e as { message?: unknown }).message : undefined;
  return coded && typeof message === 'string' && message.length > 0
    ? message
    : 'Indexing could not complete. Retry the upload or contact your administrator.';
}

const DEFAULT_INGEST_FAILURE_MESSAGE =
  'Indexing could not complete. Retry the upload or contact your administrator.';

export function sanitizeFailureMessage(error?: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : typeof error === 'object' && error !== null
        ? (error as { message?: string }).message ||
          (error as { cause?: { message?: string } }).cause?.message ||
          undefined
        : undefined;

  if (!raw || typeof raw !== 'string') return DEFAULT_INGEST_FAILURE_MESSAGE;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 250) return DEFAULT_INGEST_FAILURE_MESSAGE;

  // Technical markers indicating raw database, network, internal IDs, stack traces, or framework errors
  const technicalPatterns = [
    /Document ingestion failed/i,
    /NonRetriableError/i,
    /\b(postgres|supabase|pg_|sql|database|table|column|relation)\b/i,
    /\b(econnrefused|econnreset|etimedout|enotfound|ehostunreach)\b/i,
    /\b(fetch failed|socket hang up|network error|http \d{3})\b/i,
    /\b(syntaxerror|typeerror|referenceerror|rangeerror)\b/i,
    /\b(object\.<anonymous>|at\s+\S+\s+\()/,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    /\{.*\:.*\}/,
  ];

  if (technicalPatterns.some((pattern) => pattern.test(trimmed))) {
    return DEFAULT_INGEST_FAILURE_MESSAGE;
  }

  return trimmed;
}

const eventSchema = z.object({ documentId: z.uuid(), buildingId: z.uuid(), actorId: z.uuid() });
export async function handleIngestFailure(
  eventData: unknown,
  error: unknown,
  dbClient = adminDb(),
): Promise<{ updated: boolean; message?: string }> {
  const raw = (eventData as { event?: { data?: unknown } })?.event?.data ?? eventData;
  const v = eventSchema.safeParse(raw);
  if (!v.success) return { updated: false };
  const { data: current } = await dbClient
    .from('documents')
    .select('status,error_message')
    .eq('id', v.data.documentId)
    .maybeSingle();

  // If a step already recorded a specific failure message, preserve it
  if (current?.status === 'failed' && current?.error_message) {
    return { updated: false, message: current.error_message };
  }

  const specificMessage = sanitizeFailureMessage(error);

  await dbClient
    .from('documents')
    .update({
      status: 'failed',
      error_message: specificMessage,
    })
    .eq('id', v.data.documentId)
    .is('deleted_at', null);

  return { updated: true, message: specificMessage };
}

export const ingestDocument = inngest.createFunction(
  {
    id: 'ingest-document',
    retries: 3,
    concurrency: { limit: 1, key: 'event.data.documentId' },
    onFailure: async ({ event, error }) => {
      try {
        await handleIngestFailure(event.data, error);
      } catch (err) {
        console.error('Failed to record document failure on Inngest exhaustion:', err);
      }
    },
  },
  { event: 'document/ingest' },
  async ({ event, step }) => {
    const v = eventSchema.parse(event.data);
    const db = adminDb();
    const document = await step.run('authorize-job', async () => {
      const { data: member, error: me } = await db
        .from('building_members')
        .select('role,status,expires_at')
        .eq('building_id', v.buildingId)
        .eq('user_id', v.actorId)
        .single();
      checkDb(me);
      if (!member) throw new AppError('forbidden', 'Membership unavailable.');
      if (member.status !== 'active' || (member.expires_at && new Date(member.expires_at) <= new Date()))
        throw new AppError('forbidden', 'Ingestion authorization has expired.');
      const { data: permission, error: pe } = await db
        .from('role_permissions')
        .select('permission')
        .eq('role', member.role)
        .eq('permission', 'vault.upload');
      checkDb(pe);
      if (!permission?.length) throw new AppError('forbidden', 'Ingestion authorization has expired.');
      const { data, error } = await db
        .from('documents')
        .select('id,building_id,title,type,status,storage_path,source_url,effective_date,deleted_at')
        .eq('id', v.documentId)
        .eq('building_id', v.buildingId)
        .single();
      checkDb(error);
      if (!data) throw new AppError('not_found', 'Document unavailable.');
      if (data.deleted_at) throw new AppError('document_archived', 'This document has been archived.');
      return z
        .object({
          id: z.string(),
          building_id: z.string(),
          title: z.string(),
          type: z.string(),
          status: z.string(),
          storage_path: z.string().nullable(),
          source_url: z.string().nullable(),
          effective_date: z.string().nullable(),
        })
        .parse(data);
    });
    if (document.status === 'ready' || document.status === 'review') return { alreadyIndexed: true };
    async function status(value: string, errorMessage: string | null = null) {
      const result = await db
        .from('documents')
        .update({ status: value, error_message: errorMessage })
        .eq('id', document.id)
        .is('deleted_at', null);
      checkDb(result.error);
    }
    try {
      const parsed = await step.run('scan-and-parse', async () => {
        try {
          await status('parsing');
          if (document.source_url) {
            const { scrapePage } = await import('@/lib/security/web-source');
            const text = await scrapePage(document.source_url);
            await status('scanning');
            await assertFileClean(Buffer.from(text, 'utf8'), scanConfigFrom());
            checkDb(
              (
                await db
                  .from('documents')
                  .update({ scan_cleared_at: new Date().toISOString() })
                  .eq('id', document.id)
                  .is('deleted_at', null)
              ).error,
            );
            return text;
          }
          if (!document.storage_path) throw new AppError('file_missing', 'The uploaded file is unavailable.');
          const { data, error } = await db.storage.from('vault').download(document.storage_path);
          checkDb(error);
          if (!data) throw new AppError('file_missing', 'The uploaded file is unavailable.');
          const bytes = Buffer.from(await data.arrayBuffer());
          // Every file is scanned before it is parsed. A missing or failing scanner stops ingestion. Nothing bypasses this.
          await status('scanning');
          await assertFileClean(bytes, scanConfigFrom());
          // Storage only serves a vault file once this is set (clean scan, or scanning disabled outside production).
          checkDb(
            (
              await db
                .from('documents')
                .update({ scan_cleared_at: new Date().toISOString() })
                .eq('id', document.id)
                .is('deleted_at', null)
            ).error,
          );
          await status('parsing');
          const ext = document.storage_path.split('.').pop();
          if (ext === 'txt' || ext === 'md') return bytes.toString('utf8');
          if (ext === 'docx') {
            const mammoth = (await import('mammoth')).default;
            return (await mammoth.extractRawText({ buffer: bytes })).value;
          }
          const { pdfText } = await import('@/lib/ai/pdf-text');
          const text = await pdfText(new Uint8Array(bytes));
          assertTextLayer(text);
          return text;
        } catch (e) {
          const message = failureMessage(e);
          // Transient scanner outages or network issues should be retried by Inngest, not marked permanently failed
          if (e instanceof AppError && e.code === 'scanner_unavailable') {
            await status('scanning', message);
            throw e;
          }
          await status('failed', message);
          throw new NonRetriableError(message);
        }
      });
      const sections = await step.run('detect-structure', async () => {
        await status('chunking');
        const chunks = structuralChunks(parsed);
        if (!chunks.length) throw new AppError('empty_document', 'No readable text was found.');
        if (chunks.length > 2000)
          throw new AppError('document_too_large', 'Split this document into smaller files.');
        return chunks;
      });
      await step.run('clear-retry-chunks', async () => {
        checkDb(
          (
            await db
              .from('document_chunks')
              .delete()
              .eq('document_id', document.id)
              .eq('building_id', v.buildingId)
          ).error,
        );
        await status('embedding');
      });
      for (let i = 0; i < sections.length; i += 64) {
        await step.run('embed-batch-' + i, async () => {
          const slice = sections.slice(i, i + 64);
          const { embeddings } = await import('@/lib/ai/embeddings');
          const vectors = await embeddings(
            slice.map((s) => contextualText(document.title, document.effective_date, s)),
            'document',
          );
          const { error } = await db.from('document_chunks').upsert(
            slice.map((s, j) => ({
              document_id: document.id,
              building_id: v.buildingId,
              chunk_index: i + j,
              content: s.content,
              heading: s.heading,
              section_ref: s.sectionRef,
              page_from: s.page,
              effective_date: document.effective_date,
              embedding: JSON.stringify(vectors[j]),
            })),
            { onConflict: 'document_id,chunk_index' },
          );
          checkDb(error);
        });
      }
      await step.run('finish', async () => {
        const hash = createHash('sha256').update(parsed).digest('hex');
        checkDb(
          (
            await db.from('document_versions').upsert(
              {
                document_id: document.id,
                building_id: v.buildingId,
                content_hash: hash,
                storage_path: document.storage_path,
              },
              { onConflict: 'document_id,content_hash' },
            )
          ).error,
        );
        checkDb(
          (
            await db
              .from('documents')
              .update({
                status: 'review',
                content_hash: hash,
                parsed_sections: sections,
                error_message: null,
              })
              .eq('id', document.id)
              .is('deleted_at', null)
          ).error,
        );
      });
      return { sections: sections.length, status: 'review' };
    } catch (e) {
      // A step that failed has already recorded its message on the document. Inngest replays that failure here as a
      // copy, so the document's stored state is the source of truth. A recorded failure is not retried.
      const { data: current, error: readError } = await db
        .from('documents')
        .select('status')
        .eq('id', v.documentId)
        .maybeSingle();
      checkDb(readError);
      if (current?.status === 'failed')
        throw new NonRetriableError('Indexing stopped: the failure is recorded on the document.');
      if (current?.status === 'scanning' || (e instanceof AppError && e.code === 'scanner_unavailable')) {
        // Transient scanner outages are retried by Inngest; preserve 'scanning' status in Postgres
        throw e;
      }
      await status('failed', failureMessage(e));
      throw new Error('Document ingestion failed: ' + v.documentId);
    }
  },
);
