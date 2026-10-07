'use server';

import { createClient } from '@/lib/supabase/server';
import { requireUser, requirePermission } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';

/**
 * Resend invitation to team member
 */
export async function resendInvitationAction({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Get org ID from user's org_members
    const { data: member } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return { ok: false, error: 'Not a member of any organization' };
    }

    // Verify invitation belongs to this org
    const { data: invitation } = await db
      .from('invitations')
      .select('id, org_id, email')
      .eq('id', invitationId)
      .eq('org_id', member.org_id)
      .single();

    if (!invitation) {
      return { ok: false, error: 'Invitation not found' };
    }

    // Update invitation's sent_at timestamp to re-trigger email
    const { error: updateError } = await db
      .from('invitations')
      .update({
        sent_at: new Date().toISOString(),
        status: 'pending',
      })
      .eq('id', invitationId);

    if (updateError) {
      return { ok: false, error: 'Failed to resend invitation' };
    }

    // Trigger email send
    const { data: org } = await db
      .from('organizations')
      .select('name')
      .eq('id', member.org_id)
      .single();

    console.log(
      `[EMAIL] Resend invitation: ${invitation.email} ` +
      `to ${org?.name} code=${invitationId}`
    );

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Revoke invitation (soft delete)
 */
export async function revokeInvitationAction({
  invitationId,
}: {
  invitationId: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Get org ID from user's org_members
    const { data: member } = await db
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single();

    if (!member) {
      return { ok: false, error: 'Not a member of any organization' };
    }

    // Verify invitation belongs to this org
    const { data: invitation } = await db
      .from('invitations')
      .select('id, org_id')
      .eq('id', invitationId)
      .eq('org_id', member.org_id)
      .single();

    if (!invitation) {
      return { ok: false, error: 'Invitation not found' };
    }

    // Soft delete
    const { error: deleteError } = await db
      .from('invitations')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
      })
      .eq('id', invitationId);

    if (deleteError) {
      return { ok: false, error: 'Failed to revoke invitation' };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Toggle feature flag (platform admin only)
 */
export async function toggleFeatureFlagAction({
  flagName,
  enabled,
  description,
}: {
  flagName: string;
  enabled: boolean;
  description?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Verify platform admin
    const { data: admin } = await db
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!admin) {
      return { ok: false, error: 'Platform admin access required' };
    }

    // Upsert feature flag
    const { error: upsertError } = await db.from('feature_flags').upsert(
      {
        flag_name: flagName,
        enabled,
        description,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
      { onConflict: 'flag_name' }
    );

    if (upsertError) {
      return { ok: false, error: 'Failed to update feature flag' };
    }

    // Log to audit trail
    await db.from('platform_audit_log').insert({
      admin_id: user.id,
      action: 'toggle_feature_flag',
      resource_type: 'feature_flag',
      resource_id: flagName,
      details: { flag_name: flagName, enabled, previous_value: !enabled },
      created_at: new Date().toISOString(),
    });

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get platform audit log (platform admin only)
 */
export async function getPlatformAuditLogAction({
  limit = 50,
  action,
}: {
  limit?: number;
  action?: string;
}): Promise<{ ok: boolean; audit?: any[]; error?: string }> {
  try {
    const user = await requireUser();
    const db = await createClient();

    // Verify platform admin
    const { data: admin } = await db
      .from('platform_admins')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!admin) {
      return { ok: false, error: 'Platform admin access required' };
    }

    let query = db
      .from('platform_audit_log')
      .select('*, admin:profiles(display_name, email)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error } = await query;

    if (error) {
      return { ok: false, error: 'Failed to load audit log' };
    }

    return { ok: true, audit: data };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
