import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { checkDb, errorResponse, ForbiddenError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';

export const runtime = 'nodejs';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.string().uuid() }).parse(await params);

    const db = await createClient();

    // Get the item to verify ownership
    const { data: item } = await db
      .from('firm_knowledge')
      .select('id, organization_id, created_by')
      .eq('id', id)
      .single();

    if (!item) throw new NotFoundError('KB item not found');

    // Verify user owns the org
    const { data: org } = await db
      .from('organizations')
      .select('owner_id')
      .eq('id', item.organization_id)
      .single();

    if (!org || org.owner_id !== user.id) {
      throw new ForbiddenError('Not authorized to delete this item');
    }

    // Soft delete
    const { error } = await db
      .from('firm_knowledge')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    checkDb(error);

    return Response.json({ success: true, message: 'Deleted' });
  } catch (e) {
    return errorResponse(e);
  }
}
