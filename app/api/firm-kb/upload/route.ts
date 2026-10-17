import { requireUser, requirePermission } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { checkDb, errorResponse, ForbiddenError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Parse request
    const body = await req.json();
    const { orgId, title, type, content } = z
      .object({
        orgId: z.string().uuid(),
        title: z.string().min(1).max(500),
        type: z.enum(['template', 'precedent', 'policy', 'guidance']),
        content: z.string().min(1).max(50000),
      })
      .parse(body);

    // Verify user owns this org
    const { data: org } = await db.from('organizations').select('id, owner_id').eq('id', orgId).single();

    if (!org || org.owner_id !== user.id) {
      throw new ForbiddenError('Not authorized to add to this firm KB');
    }

    // Insert into firm_knowledge
    const { data: item, error } = await db
      .from('firm_knowledge')
      .insert({
        organization_id: orgId,
        title,
        type,
        content,
        created_by: user.id,
      })
      .select('id, title, type, content, created_at, created_by')
      .single();

    checkDb(error);

    if (!item) throw new NotFoundError('Failed to create KB item');

    return Response.json({
      id: item.id,
      title: item.title,
      type: item.type,
      content: item.content,
      uploadedAt: item.created_at,
      uploadedBy: item.created_by,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
