'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Platform Admin Actions
 * Only accessible to platform admin users
 */

const FeatureFlagSchema = z.object({
  flagName: z.string().min(1, 'Flag name required'),
  enabled: z.boolean(),
  description: z.string().optional(),
});

/**
 * Toggle a feature flag
 * Requires: platform_admin role
 */
export async function toggleFeatureFlagAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = FeatureFlagSchema.parse(raw);

    const db = await createClient();

    // Verify platform admin
    const { data: claims } = await db.auth.getUser();
    if (claims?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can manage feature flags');
    }

    // Update or create flag
    const { data: flag, error: upsertError } = await db
      .from('feature_flags')
      .upsert(
        {
          flag_name: input.flagName,
          enabled: input.enabled,
          description: input.description || null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        },
        { onConflict: 'flag_name' }
      )
      .select()
      .single();

    checkDb(upsertError);

    // Log audit
    await db
      .from('platform_admin_audit')
      .insert({
        admin_id: user.id,
        action: 'toggle_feature_flag',
        resource_type: 'feature_flag',
        resource_id: flag.id,
        details: {
          flag_name: input.flagName,
          enabled: input.enabled,
          description: input.description,
        },
      });

    return { ok: true, flag };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Grant platform admin access to a user
 * Requires: existing platform_admin (not self-service)
 */
export async function grantPlatformAdminAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ userId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify requestor is platform admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can grant admin access');
    }

    // Update target user's metadata
    const { error: updateError } = await db.auth.admin.updateUserById(input.userId, {
      user_metadata: { role: 'platform_admin' },
    });

    if (updateError) throw updateError;

    // Log audit
    await db
      .from('platform_admin_audit')
      .insert({
        admin_id: user.id,
        action: 'grant_platform_admin',
        resource_type: 'user',
        resource_id: input.userId as any,
        details: { target_user_id: input.userId },
      });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Revoke platform admin access
 * Requires: existing platform_admin
 */
export async function revokePlatformAdminAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ userId: z.string().uuid() }).parse(raw);

    if (input.userId === user.id) {
      throw new ForbiddenError('Cannot revoke your own admin access');
    }

    const db = await createClient();

    // Verify requestor is platform admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can revoke admin access');
    }

    // Update target user's metadata
    const { error: updateError } = await db.auth.admin.updateUserById(input.userId, {
      user_metadata: { role: null },
    });

    if (updateError) throw updateError;

    // Log audit
    await db
      .from('platform_admin_audit')
      .insert({
        admin_id: user.id,
        action: 'revoke_platform_admin',
        resource_type: 'user',
        resource_id: input.userId as any,
        details: { target_user_id: input.userId },
      });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Break-glass read access to any document
 * Requires: platform_admin role (high audit bar)
 */
export async function breakGlassReadAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        documentId: z.string().uuid(),
        reason: z.string().min(10, 'Reason required (audit trail)'),
      })
      .parse(raw);

    const db = await createClient();

    // Verify platform admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can access break-glass');
    }

    // Read document
    const { data: document, error: readError } = await db
      .from('documents')
      .select('*')
      .eq('id', input.documentId)
      .single();

    checkDb(readError);

    // Log high-audit break-glass access
    await db
      .from('platform_admin_audit')
      .insert({
        admin_id: user.id,
        action: 'break_glass_read',
        resource_type: 'document',
        resource_id: input.documentId as any,
        details: {
          reason: input.reason,
          building_id: document.building_id,
          document_title: document.title,
          accessed_at: new Date().toISOString(),
        },
      });

    return { ok: true, document };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * View platform audit log
 * Requires: platform_admin role
 */
export async function getPlatformAuditLogAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        limit: z.number().int().min(1).max(500).default(50),
        action: z.string().optional(),
      })
      .parse(raw);

    const db = await createClient();

    // Verify platform admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can view platform audit log');
    }

    let query = db
      .from('platform_admin_audit')
      .select(
        `
      id,
      admin_id,
      action,
      resource_type,
      resource_id,
      details,
      created_at,
      admin:profiles(display_name, email)
    `
      )
      .order('created_at', { ascending: false });

    if (input.action) {
      query = query.eq('action', input.action);
    }

    const { data, error } = await query.limit(input.limit);

    checkDb(error);

    return { ok: true, audit: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
