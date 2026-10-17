'use server';

import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Firm Onboarding Workflow
 * 5-step process for platform admin to onboard new strata management firms
 */

const StartOnboardingSchema = z.object({
  firmName: z.string().min(2, 'Firm name required'),
  contactEmail: z.string().email('Invalid email'),
  jurisdiction: z.enum(['BC', 'AB', 'ON', 'QC', 'MB', 'SK']),
});

const AddBuildingSchema = z.object({
  onboardingId: z.string().uuid(),
  buildingName: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  region: z.enum(['BC', 'AB', 'ON', 'QC', 'MB', 'SK']),
  residentCount: z.number().int().min(0),
});

const AddTeamMemberSchema = z.object({
  onboardingId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant']),
  fullName: z.string().min(1),
});

const CompleteOnboardingSchema = z.object({
  onboardingId: z.string().uuid(),
});

/**
 * Step 1: Start firm onboarding
 */
export async function startFirmOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = StartOnboardingSchema.parse(raw);

    const db = await createClient();

    // Verify platform admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can start firm onboarding');
    }

    // Create organization
    const { data: org, error: orgError } = await db
      .from('organizations')
      .insert({
        name: input.firmName,
        org_type: 'firm',
      })
      .select()
      .single();

    checkDb(orgError);

    // Create onboarding record
    const { data: onboarding, error: onboardingError } = await db
      .from('firm_onboardings')
      .insert({
        org_id: org.id,
        step: 1,
        firm_name: input.firmName,
        contact_email: input.contactEmail,
        jurisdiction: input.jurisdiction,
        initiated_by: user.id,
      })
      .select()
      .single();

    checkDb(onboardingError);

    // Audit
    await db.from('platform_admin_audit').insert({
      admin_id: user.id,
      action: 'start_firm_onboarding',
      resource_type: 'organization',
      resource_id: org.id,
      details: {
        firm_name: input.firmName,
        jurisdiction: input.jurisdiction,
      },
    });

    return { ok: true, onboardingId: onboarding.id, orgId: org.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Step 2: Add buildings to firm
 */
export async function addBuildingToOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = AddBuildingSchema.parse(raw);

    const db = await createClient();

    // Verify admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can add buildings');
    }

    // Get onboarding record
    const { data: onboarding } = await db
      .from('firm_onboardings')
      .select('org_id, buildings')
      .eq('id', input.onboardingId)
      .single();

    if (!onboarding) {
      throw new ForbiddenError('Onboarding record not found');
    }

    // Create building
    const { data: building, error: buildError } = await db
      .from('buildings')
      .insert({
        name: input.buildingName,
        address: input.address,
        city: input.city,
        region: input.region,
      })
      .select()
      .single();

    checkDb(buildError);

    // Link building to organization
    await db.from('building_links').insert({
      org_id: onboarding.org_id,
      building_id: building.id,
      link_status: 'active',
    });

    // Update onboarding record
    const buildingsList = onboarding.buildings || [];
    buildingsList.push({ building_id: building.id, building_name: input.buildingName });

    await db
      .from('firm_onboardings')
      .update({
        buildings: buildingsList,
        step: Math.max(2, 2), // At least step 2
      })
      .eq('id', input.onboardingId);

    return { ok: true, buildingId: building.id };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Step 3: Add team members to firm
 */
export async function addTeamMemberToOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = AddTeamMemberSchema.parse(raw);

    const db = await createClient();

    // Verify admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can add team members');
    }

    // Get onboarding
    const { data: onboarding } = await db
      .from('firm_onboardings')
      .select('org_id, team_members')
      .eq('id', input.onboardingId)
      .single();

    if (!onboarding) {
      throw new ForbiddenError('Onboarding record not found');
    }

    // Create invitation (not user yet)
    const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    const teamList = onboarding.team_members || [];
    teamList.push({
      email: input.email,
      role: input.role,
      fullName: input.fullName,
      inviteCode: inviteCode,
    });

    await db
      .from('firm_onboardings')
      .update({
        team_members: teamList,
        step: Math.max(3, 3),
      })
      .eq('id', input.onboardingId);

    // Send invite email with inviteCode
    try {
      const { data: onboard } = await db
        .from('firm_onboardings')
        .select('firm_name')
        .eq('id', input.onboardingId)
        .single();

      console.log(
        `[EMAIL] Firm team member invitation: ${input.email} to ${onboard?.firm_name} with code ${inviteCode}`,
      );
    } catch (emailError) {
      console.error('Failed to send team member invitation:', emailError);
    }

    return { ok: true, inviteCode };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Step 4: Configure firm settings (placeholder for step 4)
 */
export async function configureFirmSettingsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z
      .object({
        onboardingId: z.string().uuid(),
        billingEmail: z.string().email().optional(),
        notificationEmail: z.string().email().optional(),
      })
      .parse(raw);

    const db = await createClient();

    // Verify admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can configure settings');
    }

    // Update onboarding
    await db
      .from('firm_onboardings')
      .update({
        billing_email: input.billingEmail,
        notification_email: input.notificationEmail,
        step: 4,
      })
      .eq('id', input.onboardingId);

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Step 5: Complete onboarding
 */
export async function completeFirmOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = CompleteOnboardingSchema.parse(raw);

    const db = await createClient();

    // Verify admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can complete onboarding');
    }

    // Get onboarding
    const { data: onboarding } = await db
      .from('firm_onboardings')
      .select('org_id, firm_name')
      .eq('id', input.onboardingId)
      .single();

    if (!onboarding) {
      throw new ForbiddenError('Onboarding record not found');
    }

    // Mark as complete
    await db
      .from('firm_onboardings')
      .update({
        step: 5,
        completed_at: new Date().toISOString(),
        completed_by: user.id,
      })
      .eq('id', input.onboardingId);

    // Audit
    await db.from('platform_admin_audit').insert({
      admin_id: user.id,
      action: 'complete_firm_onboarding',
      resource_type: 'organization',
      resource_id: onboarding.org_id,
      details: {
        firm_name: onboarding.firm_name,
      },
    });

    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

/**
 * Get onboarding progress
 */
export async function getOnboardingProgressAction(raw: unknown) {
  try {
    const user = await requireUser();
    const input = z.object({ onboardingId: z.string().uuid() }).parse(raw);

    const db = await createClient();

    // Verify admin
    const { data: admin } = await db.auth.getUser();
    if (admin?.user?.user_metadata?.role !== 'platform_admin') {
      throw new ForbiddenError('Only platform admins can view onboarding');
    }

    const { data: onboarding, error } = await db
      .from('firm_onboardings')
      .select('*')
      .eq('id', input.onboardingId)
      .single();

    checkDb(error);

    return { ok: true, onboarding };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
