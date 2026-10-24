'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkDb, ForbiddenError, errorMessage, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

const RevokeLinkSchema = z.object({
  linkId: z.string().uuid('Invalid link ID'),
});

/**
 * Revoke a building link (remove firm access to building)
 * Sets status to 'revoked' and suspends all firm staff members
 */
export async function revokeBuildingLinkAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = RevokeLinkSchema.parse(raw);

    const db = await createClient();

    // Verify user is org_owner or org_admin
    const { data: orgMember, error: orgError } = await db
      .from('org_members')
      .select('role, org_id')
      .eq('user_id', user.id)
      .single();

    checkDb(orgError);
    if (!orgMember) throw new NotFoundError();

    if (!['org_owner', 'org_admin'].includes(orgMember.role)) {
      throw new ForbiddenError('Only organization owners and admins can revoke building links');
    }

    // Get the link
    const { data: link, error: linkError } = await db
      .from('firm_building_links')
      .select('id, building_id, firm_org_id, status')
      .eq('id', input.linkId)
      .eq('firm_org_id', orgMember.org_id)
      .single();

    checkDb(linkError);
    if (!link) throw new NotFoundError();

    if (link.status === 'revoked') {
      return { ok: false, error: 'This link is already revoked' };
    }

    // Revoke the link
    const { error: revokeError } = await db
      .from('firm_building_links')
      .update({
        status: 'revoked',
        revoked_by: user.id,
        revoked_at: new Date().toISOString(),
      })
      .eq('id', input.linkId);

    checkDb(revokeError);

    // Suspend all firm staff members linked through this building
    const { error: suspendError } = await db
      .from('building_members')
      .update({ status: 'suspended' })
      .eq('building_id', link.building_id)
      .eq('via_link_id', input.linkId);

    checkDb(suspendError);

    // Close any pending reviews in generated_documents
    const { data: pendingReviews, error: reviewsError } = await db
      .from('generated_documents')
      .select('id, building_id')
      .eq('building_id', link.building_id)
      .eq('review_by', 'firm')
      .eq('status', 'pending_review');

    checkDb(reviewsError);

    if (pendingReviews && pendingReviews.length > 0) {
      const { error: closeError } = await db
        .from('generated_documents')
        .update({
          status: 'draft',
          review_by: 'building',
          updated_at: new Date().toISOString(),
        })
        .eq('building_id', link.building_id)
        .eq('review_by', 'firm')
        .eq('status', 'pending_review');

      checkDb(closeError);

      // Add comments to closed reviews
      for (const review of pendingReviews) {
        const { error: commentError } = await db.from('document_review_comments').insert({
          document_id: review.id,
          building_id: link.building_id,
          author_id: user.id,
          body: 'Review closed: Building link to firm was revoked',
        });

        if (commentError) {
          console.error('Failed to add review comment:', commentError);
        }
      }
    }

    // Notify building managers of revocation
    await db.from('buildings').select('name, id').eq('id', link.building_id).single();

    const { data: managers, error: managersError } = await db
      .from('building_members')
      .select('user_id')
      .eq('building_id', link.building_id)
      .eq('role', 'building_manager');

    checkDb(managersError);

    for (const manager of managers || []) {
      logger.info({
        context: 'building_link_revoked_notice',
        userId: manager.user_id,
        buildingId: link.building_id,
      });
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Copy firm code to clipboard (client-side utility)
 * Note: The actual code generation happens when building invites the firm
 */
export async function generateBuildingCodeMessage(): Promise<string> {
  return 'Building administrators can generate a firm invite code in their building settings.';
}

/**
 * View building details (for admin dashboard)
 */
export async function getBuildingDetailsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ buildingId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify user has access
    const { data: orgMember } = await db.from('org_members').select('org_id').eq('user_id', user.id).single();

    if (!orgMember) throw new ForbiddenError('Not authorized');

    // Get building (must be linked to this org)
    const { data: link } = await db
      .from('firm_building_links')
      .select('building_id, status')
      .eq('building_id', input.buildingId)
      .eq('firm_org_id', orgMember.org_id)
      .single();

    if (!link) throw new ForbiddenError('You do not have access to this building');

    // Get building info
    const { data: building, error: buildingError } = await db
      .from('buildings')
      .select(
        `
        id,
        name,
        region,
        municipality,
        created_at,
        documents(count),
        building_members(count)
      `,
      )
      .eq('id', input.buildingId)
      .single();

    checkDb(buildingError);
    if (!building) throw new NotFoundError();

    return {
      ok: true,
      building: {
        id: building.id,
        name: building.name,
        jurisdiction: building.region || building.municipality || 'BC',
        region: building.region,
        createdAt: building.created_at,
        linkStatus: link.status,
        documentCount: building.documents?.[0]?.count || 0,
        staffCount: building.building_members?.[0]?.count || 0,
      },
    };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
