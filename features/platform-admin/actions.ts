'use server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, ForbiddenError, errorMessage } from '@/lib/errors';

export async function setFlagAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { flag, enabled } = z
      .object({
        flag: z.string(),
        enabled: z.boolean(),
      })
      .parse(raw);

    // Verify platform admin
    const { data: isAdmin, error } = await user.client.rpc('set_flag', {
      p_flag_name: flag,
      p_enabled: enabled,
    });

    checkDb(error);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function startOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { firmName, firmType } = z
      .object({
        firmName: z.string().min(1),
        firmType: z.enum(['independent', 'management_firm']),
      })
      .parse(raw);

    const { data: workflowId, error } = await user.client.rpc('start_onboarding', {
      p_firm_name: firmName,
      p_firm_type: firmType,
    });

    checkDb(error);
    return { ok: true, workflowId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addOnboardingBuildingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { workflowId, buildingName, jurisdiction, residentCount } = z
      .object({
        workflowId: z.string().uuid(),
        buildingName: z.string().min(1),
        jurisdiction: z.string().min(1),
        residentCount: z.number().int().positive(),
      })
      .parse(raw);

    const { data: buildingId, error } = await user.client.rpc('onboarding_add_building', {
      p_workflow_id: workflowId,
      p_building_name: buildingName,
      p_jurisdiction: jurisdiction,
      p_resident_count: residentCount,
    });

    checkDb(error);
    return { ok: true, buildingId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addOnboardingTeamMemberAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { workflowId, email, role } = z
      .object({
        workflowId: z.string().uuid(),
        email: z.string().email(),
        role: z.enum(['org_owner', 'org_admin', 'portfolio_manager', 'portfolio_assistant']),
      })
      .parse(raw);

    const { data: memberId, error } = await user.client.rpc('onboarding_add_team_member', {
      p_workflow_id: workflowId,
      p_email: email,
      p_role: role,
    });

    checkDb(error);
    return { ok: true, memberId };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function completeOnboardingAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { workflowId } = z
      .object({
        workflowId: z.string().uuid(),
      })
      .parse(raw);

    const { error } = await user.client.rpc('complete_onboarding', {
      p_workflow_id: workflowId,
    });

    checkDb(error);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getAuditLogsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { limit } = z
      .object({
        limit: z.number().int().positive().default(50),
      })
      .parse(raw || {});

    const { data, error } = await user.client.rpc('get_audit_logs', {
      p_limit: limit,
    });

    checkDb(error);
    return { ok: true, logs: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getRegionStatsAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { regionId } = z
      .object({
        regionId: z.string().uuid(),
      })
      .parse(raw);

    const { data, error } = await user.client.rpc('get_region_stats', {
      p_region_id: regionId,
    });

    checkDb(error);
    if (!data || data.length === 0) return { ok: false, error: 'Region not found' };

    return { ok: true, stats: data[0] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function searchRegionalKbAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { regionId, query, limit } = z
      .object({
        regionId: z.string().uuid(),
        query: z.string().min(1),
        limit: z.number().int().positive().default(20),
      })
      .parse(raw);

    const { data, error } = await user.client.rpc('search_regional_kb', {
      p_region_id: regionId,
      p_query: query,
      p_limit: limit,
    });

    checkDb(error);
    return { ok: true, results: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function searchUniversalKbAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { query, limit } = z
      .object({
        query: z.string().min(1),
        limit: z.number().int().positive().default(20),
      })
      .parse(raw);

    const { data, error } = await user.client.rpc('search_universal_kb', {
      p_query: query,
      p_limit: limit,
    });

    checkDb(error);
    return { ok: true, results: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getAllRegionsAction() {
  try {
    const user = await requireUser();

    const { data, error } = await user.client.rpc('get_all_regions');

    checkDb(error);
    return { ok: true, regions: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getBuildingTransferCandidatesAction() {
  try {
    const user = await requireUser();
    const { data, error } = await user.client.rpc('get_building_transfer_candidates');
    checkDb(error);
    return { ok: true, candidates: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getFirmTransferDestinationsAction() {
  try {
    const user = await requireUser();
    const { data, error } = await user.client.rpc('get_firm_transfer_destinations');
    checkDb(error);
    return { ok: true, firms: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function getFirmManagersAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { firmId } = z
      .object({
        firmId: z.string().uuid(),
      })
      .parse(raw);

    const { data, error } = await user.client.rpc('get_firm_managers', {
      p_firm_id: firmId,
    });
    checkDb(error);
    return { ok: true, managers: data || [] };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function transferBuildingFirmAction(raw: unknown) {
  try {
    const user = await requireUser();
    const { buildingId, targetFirmOrgId, targetManagerUserId } = z
      .object({
        buildingId: z.string().uuid(),
        targetFirmOrgId: z.string().uuid(),
        targetManagerUserId: z.string().uuid().nullable().optional(),
      })
      .parse(raw);

    const { data, error } = await user.client.rpc('transfer_building_firm', {
      p_building_id: buildingId,
      p_target_firm_org_id: targetFirmOrgId,
      p_target_manager_user_id: targetManagerUserId ?? null,
    });

    checkDb(error);
    return { ok: true, result: data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

