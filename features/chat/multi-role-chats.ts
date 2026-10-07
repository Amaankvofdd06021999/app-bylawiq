import 'server-only';
import { z } from 'zod';
import type { SessionUser } from '@/lib/auth/guards';
import type { Source } from '@/lib/ai/citations';
import { checkDb } from '@/lib/errors';
import { createClient } from '@/lib/supabase/server';

/**
 * Multi-role chat contexts
 * Each role has different permissions, knowledge bases, and scopes
 */

export type ChatRole = 'resident' | 'building_manager' | 'strata_manager' | 'firm_owner' | 'platform_admin';

export interface ChatContext {
  role: ChatRole;
  userId: string;
  buildingId?: string; // Single building context
  buildingIds?: string[]; // Multi-building context (portfolio)
  orgId?: string;
  accessLevel: 'personal' | 'building' | 'portfolio' | 'firm' | 'platform';
}

/**
 * Determine user's chat role and context
 */
export async function getUserChatContext(user: SessionUser): Promise<ChatContext | null> {
  const db = await createClient();

  // Check if platform admin
  const { data: admin } = await db
    .from('platform_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (admin) {
    return {
      role: 'platform_admin',
      userId: user.id,
      accessLevel: 'platform',
    };
  }

  // Check if firm owner
  const { data: firmOwner } = await db
    .from('organizations')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle();

  if (firmOwner) {
    return {
      role: 'firm_owner',
      userId: user.id,
      orgId: firmOwner.id,
      accessLevel: 'firm',
    };
  }

  // Check if strata manager (has org_assignments to multiple buildings)
  const { data: assignments, error } = await db
    .from('org_assignments')
    .select('building_id')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  checkDb(error);

  if (assignments && assignments.length > 0) {
    const buildingIds = assignments.map((a) => a.building_id);

    // Get org from first building
    const { data: building } = await db
      .from('buildings')
      .select('organization_id')
      .eq('id', buildingIds[0])
      .single();

    return {
      role: 'strata_manager',
      userId: user.id,
      buildingIds,
      orgId: building?.organization_id,
      accessLevel: 'portfolio',
    };
  }

  // Check if building manager (has role in a building)
  const { data: memberData } = await db
    .from('building_members')
    .select('building_id,role')
    .eq('user_id', user.id)
    .eq('role', 'building_manager')
    .eq('status', 'active')
    .maybeSingle();

  if (memberData) {
    return {
      role: 'building_manager',
      userId: user.id,
      buildingId: memberData.building_id,
      accessLevel: 'building',
    };
  }

  // Check if resident
  const { data: residentData } = await db
    .from('building_members')
    .select('building_id')
    .eq('user_id', user.id)
    .eq('role', 'owner_resident')
    .eq('status', 'active')
    .maybeSingle();

  if (residentData) {
    return {
      role: 'resident',
      userId: user.id,
      buildingId: residentData.building_id,
      accessLevel: 'personal',
    };
  }

  return null;
}

/**
 * Build system prompt based on chat role
 * Each role gets different instructions and access levels
 */
export function buildRolePrompt(context: ChatContext): string {
  const basePrompt = `You are a helpful AI assistant for building and strata property law. You have access to relevant building documents, bylaws, and BC legislation.

When responding:
- Always ground answers in retrieved sources [1], [2], etc.
- Include a disclaimer about not being a lawyer
- Suggest professional review for complex matters
- Refuse requests outside your scope`;

  const rolePrompts: Record<ChatRole, string> = {
    resident: `${basePrompt}

You are helping a resident. Remember:
- Only provide information about THEIR building (${context.buildingId || 'unknown'})
- Focus on resident-friendly explanations
- Never help with legal disputes or analysis against the building
- Decline requests for confidential resident information
- All responses are verified for safety before display`,

    building_manager: `${basePrompt}

You are helping a building manager. You have access to:
- All building documents (bylaws, policies, minutes, reports)
- Firm knowledge base (templates, precedents)
- BC strata legislation and regulations
- Common dispute patterns across similar buildings

Provide detailed analysis and drafting assistance for notices, policies, etc.
Assume professional legal knowledge — use technical terms appropriately.`,

    strata_manager: `${basePrompt}

You are helping a strata manager overseeing multiple buildings (${context.buildingIds?.length || 0} properties).

You can:
- Compare bylaws and policies across your portfolio
- Identify common issues and best practices
- Provide comparative analysis
- Access all buildings' documents you manage
- Query firm knowledge base

When citing sources, always include building name context.
Example: "[1 - Oakridge Towers]", "[2 - Westmont Condos]"`,

    firm_owner: `${basePrompt}

You are helping a firm owner managing multiple buildings and teams.

You have access to:
- All buildings you own/manage
- Firm knowledge base (internal templates, precedents, policies)
- Cross-building analytics and patterns
- Team performance data (anonymized)
- Regional trends and benchmarks

Provide strategic insights and firm-level analytics.
Focus on aggregate patterns and firm-wide improvements.`,

    platform_admin: `${basePrompt}

You are the platform administrator for BylawIQ.

You have access to:
- All regional knowledge bases (BC, AB, ON, etc.)
- Platform-wide usage analytics
- System health and performance metrics
- Regional KB coverage and quality metrics
- Feature usage patterns across organizations

Help with:
- Platform configuration and optimization
- Regional KB maintenance and updates
- System monitoring and troubleshooting
- Strategic platform decisions`,
  };

  return rolePrompts[context.role] || basePrompt;
}

/**
 * Determine which knowledge bases a user can access
 */
export async function getAccessibleKnowledgeBases(
  context: ChatContext
): Promise<{
  buildingDocs: string[]; // building IDs
  firmKnowledge: boolean;
  regionalKB: boolean;
  staffDocuments: boolean;
}> {
  return {
    buildingDocs:
      context.role === 'resident'
        ? context.buildingId
          ? [context.buildingId]
          : []
        : context.role === 'building_manager'
          ? context.buildingId
            ? [context.buildingId]
            : []
          : context.role === 'strata_manager'
            ? context.buildingIds || []
            : context.role === 'firm_owner'
              ? [] // Handled by org, not building IDs
              : [], // Platform admin sees all

    firmKnowledge:
      context.role !== 'resident' && context.role !== 'platform_admin',

    regionalKB: true, // All authenticated users can access

    staffDocuments:
      context.role !== 'resident', // Only staff can access staff-only documents
  };
}

/**
 * Format retrieved sources for different roles
 * Residents: minimal info, just answer
 * Staff: full details, section refs, building context
 * Portfolio: include building name/labels
 */
export function formatSourcesForRole(role: ChatRole, sources: Source[]): Source[] {
  if (role === 'resident') {
    // Residents get sanitized sources (no internal metadata)
    return sources.map((s) => ({
      ...s,
      effectiveDate: undefined, // Hide effective dates to avoid confusion
    }));
  }

  if (role === 'strata_manager') {
    // Add building labels to sources
    return sources.map((s) => ({
      ...s,
      title: s.buildingId
        ? `${s.title} (${s.buildingId})`
        : s.title,
    }));
  }

  // All other staff get full source information
  return sources;
}
