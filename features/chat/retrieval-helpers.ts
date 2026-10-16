import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import { z } from 'zod';

/**
 * Retrieval helper functions for integrating staff documents and financial data
 * into the chat context for building managers, strata managers, and firm owners.
 */

// Get staff-only documents for a building manager
export async function retrieveStaffDocuments(user: SessionUser, buildingId: string, query: string) {
  const documents: Array<{
    id: string;
    kind: 'maintenance' | 'vendor' | 'insurance';
    title: string;
    content: string;
    metadata: Record<string, unknown>;
  }> = [];

  // Search maintenance logs
  try {
    const { data: logs, error: logsError } = await user.client.rpc('search_maintenance_logs', {
      p_building_id: buildingId,
      p_query: query,
      p_limit: 5,
    });

    checkDb(logsError);

    if (logs && Array.isArray(logs)) {
      const parsed = z
        .array(
          z.object({
            log_id: z.string().uuid(),
            issue_type: z.string(),
            description: z.string(),
            severity: z.string(),
            status: z.string(),
            reported_at: z.string(),
            resolved_at: z.string().nullable(),
            actual_cost: z.number().nullable(),
          }),
        )
        .parse(logs);

      for (const log of parsed) {
        documents.push({
          id: log.log_id,
          kind: 'maintenance',
          title: `Maintenance: ${log.issue_type} (${log.severity})`,
          content: log.description,
          metadata: {
            status: log.status,
            reported: log.reported_at,
            resolved: log.resolved_at,
            cost: log.actual_cost,
          },
        });
      }
    }
  } catch {
    // Silently fail on individual document type searches
  }

  // Search vendor contracts
  try {
    const { data: contracts, error: contractsError } = await user.client.rpc('search_vendor_contracts', {
      p_building_id: buildingId,
      p_query: query,
      p_limit: 5,
    });

    checkDb(contractsError);

    if (contracts && Array.isArray(contracts)) {
      const parsed = z
        .array(
          z.object({
            contract_id: z.string().uuid(),
            vendor_name: z.string(),
            service_type: z.string(),
            contract_start_date: z.string(),
            contract_end_date: z.string(),
            monthly_cost: z.number().nullable(),
            annual_cost: z.number().nullable(),
            status: z.string(),
          }),
        )
        .parse(contracts);

      for (const contract of parsed) {
        documents.push({
          id: contract.contract_id,
          kind: 'vendor',
          title: `Vendor: ${contract.vendor_name} (${contract.service_type})`,
          content: `Service: ${contract.service_type}. Contract: ${contract.contract_start_date} to ${contract.contract_end_date}. Cost: $${contract.monthly_cost || contract.annual_cost || 'N/A'}/month or year.`,
          metadata: {
            vendor: contract.vendor_name,
            service: contract.service_type,
            status: contract.status,
            endDate: contract.contract_end_date,
          },
        });
      }
    }
  } catch {
    // Silently fail
  }

  // Search insurance policies
  try {
    const { data: policies, error: policiesError } = await user.client.rpc('search_insurance_policies', {
      p_building_id: buildingId,
      p_query: query,
      p_limit: 5,
    });

    checkDb(policiesError);

    if (policies && Array.isArray(policies)) {
      const parsed = z
        .array(
          z.object({
            policy_id: z.string().uuid(),
            provider_name: z.string(),
            policy_type: z.string(),
            coverage_amount: z.number(),
            deductible: z.number(),
            policy_start_date: z.string(),
            policy_end_date: z.string(),
            status: z.string(),
          }),
        )
        .parse(policies);

      for (const policy of parsed) {
        documents.push({
          id: policy.policy_id,
          kind: 'insurance',
          title: `Insurance: ${policy.policy_type} (${policy.provider_name})`,
          content: `Coverage: $${policy.coverage_amount}. Deductible: $${policy.deductible}. Policy: ${policy.policy_start_date} to ${policy.policy_end_date}.`,
          metadata: {
            provider: policy.provider_name,
            type: policy.policy_type,
            coverage: policy.coverage_amount,
            deductible: policy.deductible,
            status: policy.status,
          },
        });
      }
    }
  } catch {
    // Silently fail
  }

  return documents;
}

// Get spending summary for a building
export async function getBuildingSpendingSummary(user: SessionUser, buildingId: string) {
  const { data, error } = await user.client.rpc('get_building_spending_summary', {
    p_building_id: buildingId,
  });

  checkDb(error);
  return data;
}

// Compare spending across buildings (for portfolio managers)
export async function compareMultiBuildingSpending(user: SessionUser, buildingIds: string[]) {
  const { data, error } = await user.client.rpc('compare_building_spending', {
    p_building_ids: buildingIds,
  });

  checkDb(error);

  if (!data) return [];

  const parsed = z
    .array(
      z.object({
        building_id: z.string().uuid(),
        building_name: z.string(),
        residents_active: z.number(),
        questions_asked: z.number(),
        total_spent_usd: z.number(),
        avg_spend_per_resident: z.number(),
        ranking: z.number(),
      }),
    )
    .parse(data);

  return parsed;
}

// Get org-wide spending summary (for firm owner)
export async function getOrgSpendingSummary(user: SessionUser, orgId: string) {
  const { data, error } = await user.client.rpc('get_org_spending_summary', {
    p_org_id: orgId,
  });

  checkDb(error);
  return data;
}

// Get org budget status (for firm owner oversight)
export async function getOrgBudgetStatus(user: SessionUser, orgId: string) {
  const { data, error } = await user.client.rpc('get_org_budget_status', {
    p_org_id: orgId,
  });

  checkDb(error);

  if (!data || !Array.isArray(data) || data.length === 0) return null;

  const parsed = z
    .object({
      org_id: z.string().uuid(),
      month: z.string(),
      monthly_limit_usd: z.number(),
      total_spent_usd: z.number(),
      pct_spent: z.number(),
      remaining_budget: z.number(),
      status: z.enum(['EXCEEDED', 'THRESHOLD_REACHED', 'OK']),
      alert_level: z.enum(['CRITICAL', 'WARNING', 'CAUTION', 'HEALTHY']),
    })
    .parse(data[0]);

  return parsed;
}
