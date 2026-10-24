'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { requirePlatformAdmin } from '@/lib/auth/platform-admin';
import { directoryFor } from '@/lib/directory';
import { checkDb, ForbiddenError, errorMessage, AppError, NotFoundError } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';
import {
  getAllBuildings,
  getAllOrganizations,
  getAllUsers,
  getFeatureFlags,
  getRegionalKBStats,
} from './platform-queries';

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
    await requirePlatformAdmin(user, 'Only platform admins can manage feature flags');

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
        { onConflict: 'flag_name' },
      )
      .select()
      .single();

    checkDb(upsertError);

    // Log audit
    await db.from('platform_admin_audit').insert({
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
    z.object({ userId: z.string().uuid() }).parse(raw);

    // Verify requestor is platform admin
    await requirePlatformAdmin(user, 'Only platform admins can grant admin access');

    throw new AppError('not_available', 'Platform admin access is managed in the database for now.', 501);
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

    // Verify requestor is platform admin
    await requirePlatformAdmin(user, 'Only platform admins can revoke admin access');

    throw new AppError('not_available', 'Platform admin access is managed in the database for now.', 501);
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
    await requirePlatformAdmin(user, 'Only platform admins can access break-glass');

    // Read document
    const { data: document, error: readError } = await db
      .from('documents')
      .select('id, building_id, title, type, status, storage_path, created_at')
      .eq('id', input.documentId)
      .maybeSingle();

    checkDb(readError);
    if (!document) {
      throw new NotFoundError('Document not found or inaccessible under current security scope');
    }

    // Log high-audit break-glass access
    await db.from('platform_admin_audit').insert({
      admin_id: user.id,
      action: 'break_glass_read',
      resource_type: 'document',
      resource_id: input.documentId,
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

    const { data: isAdmin, error: adminError } = await user.client.rpc('is_platform_admin');
    checkDb(adminError);
    if (isAdmin !== true) {
      throw new ForbiddenError('Only platform admins can view platform audit log');
    }

    const db = await createClient();
    let query = db
      .from('platform_admin_audit')
      .select('id, admin_id, action, resource_type, resource_id, details, created_at')
      .order('created_at', { ascending: false });

    if (input.action) {
      query = query.eq('action', input.action);
    }

    const { data, error } = await query.limit(input.limit);
    checkDb(error);

    const rows = data ?? [];
    const directory = await directoryFor(
      user,
      rows.map((r) => r.admin_id),
    );
    const audit = rows.map((r) => ({
      ...r,
      admin: {
        display_name: directory.get(r.admin_id)?.displayName ?? null,
        email: directory.get(r.admin_id)?.email ?? null,
      },
    }));

    return { ok: true, audit };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function loadPlatformStatsAction() {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user, 'Only platform admins can view platform statistics');
    const [organizations, buildings, users, regionalKbs] = await Promise.all([
      getAllOrganizations(),
      getAllBuildings(),
      getAllUsers(),
      getRegionalKBStats(),
    ]);
    return { ok: true as const, organizations, buildings, users, regionalKbs };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}

export async function loadFeatureFlagsAction() {
  try {
    const user = await requireUser();
    await requirePlatformAdmin(user, 'Only platform admins can view feature flags');
    return { ok: true as const, flags: await getFeatureFlags() };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
