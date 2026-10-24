import 'server-only';
import type { Source } from '@/lib/ai/citations';
import { createClient } from '@/lib/supabase/server';
import { checkDb } from '@/lib/errors';
import type { SessionUser } from '@/lib/auth/guards';

/**
 * Citation analytics and tracking
 * Track which sources are used, how often, and verify accuracy
 */

export interface CitationMetrics {
  total: number;
  valid: number;
  invalid: number;
  passRate: number; // valid / total
  bySourceKind: Record<string, number>; // kind → count
  averagePerResponse: number;
}

/**
 * Parse citations from response text
 * Extracts [1], [2], etc. references
 */
export function parseCitations(text: string): number[] {
  const matches = text.match(/\[\d+\]/g) || [];
  return matches
    .map((m) => parseInt(m.slice(1, -1)))
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);
}

/**
 * Validate citations against sources
 * Ensures every citation [1], [2] refers to an actual source
 */
export function validateCitations(
  text: string,
  sources: Source[],
): {
  valid: boolean;
  invalid: number[];
  missingCount: number;
} {
  const cited = parseCitations(text);
  const invalid: number[] = [];

  for (const idx of cited) {
    if (idx < 1 || idx > sources.length) {
      invalid.push(idx);
    }
  }

  // Check if answer has at least one citation (unless it's "no grounding" response)
  const hasNoGroundingMarker = /I could not find|no information|no access/.test(text);
  const missingCount = !hasNoGroundingMarker && cited.length === 0 ? 1 : 0;

  return {
    valid: invalid.length === 0 && missingCount === 0,
    invalid,
    missingCount,
  };
}

/**
 * Track citation usage for analytics
 */
export async function trackCitationUsage(
  user: SessionUser,
  data: {
    buildingId: string;
    responseId: string;
    query: string;
    usedSources: Source[];
    totalSources: number;
    citationCount: number;
    isValid: boolean;
  },
): Promise<void> {
  const db = await createClient();

  try {
    const byKind: Record<string, number> = {};
    for (const source of data.usedSources) {
      byKind[source.kind] = (byKind[source.kind] || 0) + 1;
    }

    await db.from('citation_usage').insert({
      user_id: user.id,
      building_id: data.buildingId,
      response_id: data.responseId,
      query_length: data.query.length,
      used_sources: data.usedSources.length,
      total_sources_available: data.totalSources,
      citation_count: data.citationCount,
      by_kind: byKind,
      valid: data.isValid,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to track citation usage:', error);
  }
}

/**
 * Get citation metrics for a building
 */
export async function getCitationMetrics(buildingId: string, days: number = 30): Promise<CitationMetrics> {
  const db = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await db
    .from('citation_usage')
    .select('*')
    .eq('building_id', buildingId)
    .gte('created_at', startDate.toISOString());

  checkDb(error);

  if (!data || data.length === 0) {
    return {
      total: 0,
      valid: 0,
      invalid: 0,
      passRate: 0,
      bySourceKind: {},
      averagePerResponse: 0,
    };
  }

  const valid = data.filter((d) => d.valid).length;
  const byKind: Record<string, number> = {};

  for (const row of data) {
    const kinds = row.by_kind || {};
    for (const [kind, count] of Object.entries(kinds)) {
      byKind[kind] = (byKind[kind] || 0) + (count as number);
    }
  }

  return {
    total: data.length,
    valid,
    invalid: data.length - valid,
    passRate: data.length > 0 ? valid / data.length : 0,
    bySourceKind: byKind,
    averagePerResponse: data.reduce((sum, d) => sum + d.citation_count, 0) / data.length,
  };
}

/**
 * Get analytics for a building's Q&A sessions
 */
export async function getBuildingChatAnalytics(buildingId: string, days: number = 30) {
  const db = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: sessions, error: sessionsError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .eq('building_id', buildingId)
    .eq('action', 'resident_answer')
    .gte('created_at', startDate.toISOString());

  checkDb(sessionsError);

  const { data: failed, error: failedError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .eq('building_id', buildingId)
    .eq('action', 'verification_failed')
    .gte('created_at', startDate.toISOString());

  checkDb(failedError);

  const { data: rateLimited, error: rateLimitError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .eq('building_id', buildingId)
    .eq('action', 'rate_limit_hit')
    .gte('created_at', startDate.toISOString());

  checkDb(rateLimitError);

  const totalSessions = sessions?.length || 0;
  const failedCount = failed?.length || 0;
  const rateLimitCount = rateLimited?.length || 0;

  // Calculate average response time (estimate from tokens)
  const totalTokens = (sessions || []).reduce((sum, s) => sum + ((s.details?.tokens as number) || 0), 0);
  const avgTokensPerResponse = totalSessions > 0 ? totalTokens / totalSessions : 0;

  // Calculate cost (estimate: $0.01 per 1000 tokens)
  const totalCost = (sessions || []).reduce((sum, s) => sum + ((s.details?.cost as number) || 0), 0);

  return {
    period: `Last ${days} days`,
    totalSessions,
    failedVerification: failedCount,
    failureRate: totalSessions > 0 ? failedCount / totalSessions : 0,
    rateLimited: rateLimitCount,
    averageTokensPerResponse: Math.round(avgTokensPerResponse),
    totalTokensUsed: totalTokens,
    estimatedCost: totalCost.toFixed(2),
    uniqueUsers: new Set((sessions || []).map((s) => s.user_id)).size,
  };
}

/**
 * Get firm-wide chat analytics
 */
export async function getFirmChatAnalytics(orgId: string, days: number = 30) {
  const db = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get all buildings linked to or owned by this org
  const { data: links, error: linksError } = await db
    .from('firm_building_links')
    .select('building_id')
    .eq('firm_org_id', orgId)
    .eq('status', 'active');

  checkDb(linksError);

  const { data: directBuildings, error: directError } = await db
    .from('buildings')
    .select('id')
    .eq('org_id', orgId);

  checkDb(directError);

  const buildingIdSet = new Set<string>();
  (links ?? []).forEach((l) => buildingIdSet.add(l.building_id));
  (directBuildings ?? []).forEach((b) => buildingIdSet.add(b.id));

  const buildingIds = Array.from(buildingIdSet);

  // Get sessions across all buildings
  const { data: sessions, error: sessionsError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .in('building_id', buildingIds)
    .eq('action', 'resident_answer')
    .gte('created_at', startDate.toISOString());

  checkDb(sessionsError);

  const { data: failed, error: failedError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .in('building_id', buildingIds)
    .eq('action', 'verification_failed')
    .gte('created_at', startDate.toISOString());

  checkDb(failedError);

  const totalSessions = sessions?.length || 0;
  const failedCount = failed?.length || 0;

  const totalCost = (sessions || []).reduce((sum, s) => sum + ((s.details?.cost as number) || 0), 0);

  return {
    buildings: buildingIds.length,
    totalSessions,
    failureRate: totalSessions > 0 ? failedCount / totalSessions : 0,
    averageCostPerSession: totalSessions > 0 ? totalCost / totalSessions : 0,
    totalSpend: totalCost.toFixed(2),
    uniqueResidents: new Set((sessions || []).map((s) => s.user_id)).size,
    period: `Last ${days} days`,
  };
}

/**
 * Get platform-wide analytics (admin only)
 */
export async function getPlatformChatAnalytics(days: number = 30) {
  const db = await createClient();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data: sessions, error: sessionsError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .eq('action', 'resident_answer')
    .gte('created_at', startDate.toISOString());

  checkDb(sessionsError);

  const { data: failed, error: failedError } = await db
    .from('resident_audit_log')
    .select('id, user_id, building_id, action, details, created_at')
    .eq('action', 'verification_failed')
    .gte('created_at', startDate.toISOString());

  checkDb(failedError);

  const totalSessions = sessions?.length || 0;
  const failedCount = failed?.length || 0;

  const totalCost = (sessions || []).reduce((sum, s) => sum + ((s.details?.cost as number) || 0), 0);

  // Get unique buildings and orgs
  const uniqueBuildings = new Set((sessions || []).map((s) => s.building_id)).size;
  const uniqueResidents = new Set((sessions || []).map((s) => s.user_id)).size;

  return {
    period: `Last ${days} days`,
    totalSessions,
    failureRate: totalSessions > 0 ? failedCount / totalSessions : 0,
    buildingsWithActivity: uniqueBuildings,
    uniqueResidents,
    totalSpend: totalCost.toFixed(2),
    avgCostPerSession: totalSessions > 0 ? (totalCost / totalSessions).toFixed(4) : '0',
  };
}
