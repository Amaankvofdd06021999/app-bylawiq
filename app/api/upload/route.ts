import { z } from 'zod';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { sameOrigin } from '@/lib/security/origin';
import { rateLimit } from '@/lib/security/rate-limit';
import { checkDb, errorResponse, AppError } from '@/lib/errors';
import { inngest } from '@/inngest/client';
import { DOCUMENT_TYPES } from '@/lib/constants';
export const runtime = 'nodejs';

// Decision D16: below the serverless request-body limit of the deployment (Vercel's documented default is 4.5 MB; confirm
// it in the deployed project). Larger files need direct-to-Storage upload, which is not built yet.
const UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
const UPLOAD_LIMIT_LABEL = '4 MB';
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    sameOrigin(req);
    if (Number(req.headers.get('content-length')) > UPLOAD_LIMIT_BYTES + 512 * 1024)
      throw new AppError('file_size', `The file must be under ${UPLOAD_LIMIT_LABEL}.`);
    const f = await req.formData();
    const v = z
      .object({
        buildingId: z.uuid(),
        title: z.string().min(1).max(180),
        type: z.enum(DOCUMENT_TYPES),
        knowledgeBaseId: z.union([z.uuid(), z.literal('')]),
        effectiveDate: z.union([z.iso.date(), z.literal('')]),
        filingReference: z.string().max(100),
        consent: z.literal('on'),
      })
      .parse(Object.fromEntries(f));
    await requirePermission(user, 'vault.upload', v.buildingId);
    await rateLimit(v.buildingId, 'upload');
    const file = f.get('file');
    if (!(file instanceof File) || file.size > UPLOAD_LIMIT_BYTES || file.size < 1)
      throw new AppError('file_size', `Choose a file under ${UPLOAD_LIMIT_LABEL}.`);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    if (!ext || !mime[ext]) throw new AppError('file_type', 'Use a PDF, DOCX, TXT, or Markdown file.');
    const bytes = Buffer.from(await file.arrayBuffer());
    if (ext === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-')
      throw new AppError('file_type', 'The file does not appear to be a PDF.');
    if (ext === 'docx' && bytes.subarray(0, 2).toString() !== 'PK')
      throw new AppError('file_type', 'The file does not appear to be a DOCX.');
    const id = crypto.randomUUID();
    const path = v.buildingId + '/' + id + '/source.' + ext;
    // Storage first, so a document row never points at a file that was not stored. If the row write fails, the stored
    // object is removed so no orphaned file remains.
    const upload = await user.client.storage
      .from('vault')
      .upload(path, bytes, { contentType: mime[ext], upsert: false });
    checkDb(upload.error);
    const { error } = await user.client.from('documents').insert({
      id,
      building_id: v.buildingId,
      title: v.title,
      type: v.type,
      knowledge_base_id: v.knowledgeBaseId || null,
      effective_date: v.effectiveDate || null,
      lto_filing_ref: v.filingReference || null,
      storage_path: path,
      uploaded_by: user.id,
      byte_size: file.size,
    });
    if (error) {
      await user.client.storage.from('vault').remove([path]);
      checkDb(error);
    }
    // The row stays 'uploaded' if the event cannot be sent. The retry route accepts 'uploaded' and 'failed', so the
    // user can retry from the document list without re-uploading.
    try {
      await inngest.send({
        name: 'document/ingest',
        data: { documentId: id, buildingId: v.buildingId, actorId: user.id },
      });
    } catch {
      throw new AppError(
        'indexing_unavailable',
        'The file was saved, but indexing did not start. Retry from the document list.',
        503,
      );
    }
    return Response.json({ id }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
