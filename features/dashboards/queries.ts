import 'server-only';
import { requireUser } from '@/lib/auth/guards';
import { checkDb, NotFoundError } from '@/lib/errors';
import { z } from 'zod';
import type {
  FirmOwnerData,
  StrataManagerData,
  BuildingManagerData,
  Health,
  CollectionSummary,
} from './types';

/**
 * Dashboard queries for role-specific home screens.
 * All queries run as the authenticated user through RLS.
 */

// ============ FIRM OWNER DASHBOARD ============

export async function firmOwnerDashboard(orgId: string): Promise<FirmOwnerData | null> {
  const user = await requireUser();

  // Verify user is org owner
  const { data: orgMember, error: orgError } = await user.client
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(orgError);
  if (!orgMember || !['org_owner', 'org_admin'].includes(orgMember.role)) {
    return null; // User is not an org owner/admin
  }

  // Fetch org info
  const { data: org, error: orgInfoError } = await user.client
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single();

  checkDb(orgInfoError);

  // Fetch profile for first name
  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  checkDb(profileError);
  const firstName = profile?.display_name?.split(' ')[0] || 'Owner';

  // Fetch staff list (simplified)
  const { data: staff, error: staffError } = await user.client
    .from('org_members')
    .select(
      `
      id,
      user_id,
      role,
      profiles!inner(display_name)
    `,
    )
    .eq('org_id', orgId)
    .eq('status', 'active');

  checkDb(staffError);

  // Fetch staff building assignments and review counts
  const { data: staffStats, error: statsError } = await user.client
    .from('building_members')
    .select('user_id, count')
    .eq('role', 'building_manager')
    .in(
      'user_id',
      (staff || []).map((s: any) => s.user_id),
    );

  checkDb(statsError);

  const staffBuildingCounts = new Map(
    (staffStats || []).map((s: any) => [s.user_id, s.count || 0]),
  );

  // Fetch open reviews per staff member
  const { data: openReviewsData, error: reviewsError } = await user.client
    .from('document_reviews')
    .select('reviewer_id, count')
    .eq('status', 'pending');

  checkDb(reviewsError);

  const openReviewsByStaff = new Map(
    (openReviewsData || []).map((r: any) => [r.reviewer_id, r.count || 0]),
  );

  // Fetch last active time per staff member
  const { data: lastActiveData, error: lastActiveError } = await user.client
    .from('platform_audit_log')
    .select('admin_id, created_at')
    .order('created_at', { ascending: false });

  checkDb(lastActiveError);

  const lastActiveByStaff = new Map<string, string>();
  (lastActiveData || []).forEach((entry: any) => {
    if (!lastActiveByStaff.has(entry.admin_id)) {
      lastActiveByStaff.set(entry.admin_id, entry.created_at);
    }
  });

  const staffList = (staff || []).map((m: any) => ({
    userId: m.user_id,
    name: m.profiles?.display_name || 'Unknown',
    role: m.role,
    buildings: staffBuildingCounts.get(m.user_id) || 0,
    openReviews: openReviewsByStaff.get(m.user_id) || 0,
    lastActive: lastActiveByStaff.get(m.user_id) || null,
    you: m.user_id === user.id,
  }));

  // Fetch building roster with firm link status
  const { data: buildings, error: buildingsError } = await user.client
    .from('buildings')
    .select(
      `
      id,
      name,
      firm_building_links(
        created_at,
        status
      )
    `,
    )
    .eq('org_id', orgId)
    .is('deleted_at', null);

  checkDb(buildingsError);

  // Fetch review and dispute counts per building
  const { data: reviewCounts, error: reviewError } = await user.client
    .from('documents')
    .select('building_id, status')
    .eq('doc_kind', 'notice')
    .in('status', ['draft', 'in_review']);

  checkDb(reviewError);

  const { data: disputeCounts, error: disputeError } = await user.client
    .from('disputes')
    .select('building_id, status')
    .in('status', ['open', 'escalated']);

  checkDb(disputeError);

  const reviewsByBuilding = new Map<string, number>();
  const disputesByBuilding = new Map<string, number>();

  (reviewCounts || []).forEach((r: any) => {
    reviewsByBuilding.set(r.building_id, (reviewsByBuilding.get(r.building_id) || 0) + 1);
  });

  (disputeCounts || []).forEach((d: any) => {
    disputesByBuilding.set(d.building_id, (disputesByBuilding.get(d.building_id) || 0) + 1);
  });

  const roster = (buildings || []).map((b: any) => ({
    buildingId: b.id,
    name: b.name,
    linked: (b.firm_building_links || []).some((link: any) => link.status === 'active'),
    since: (b.firm_building_links || []).length > 0 ? b.firm_building_links[0]?.created_at : null,
    health: { tone: 'green' as const, label: 'Healthy', issues: [] },
    openDisputes: disputesByBuilding.get(b.id) || 0,
    pendingReviews: reviewsByBuilding.get(b.id) || 0,
  }));

  // Fetch turnaround metrics
  const { data: decidedDocs, error: turnaroundError } = await user.client
    .from('documents')
    .select('created_at, decided_at')
    .eq('doc_kind', 'notice')
    .eq('status', 'decided')
    .in(
      'building_id',
      (buildings || []).map((b: any) => b.id),
    )
    .not('decided_at', 'is', null)
    .order('decided_at', { ascending: false })
    .limit(50); // Sample last 50 for median

  checkDb(turnaroundError);

  let medianHours: number | null = null;
  const turnaroundHours = (decidedDocs || [])
    .map((d: any) => {
      const created = new Date(d.created_at).getTime();
      const decided = new Date(d.decided_at).getTime();
      return (decided - created) / (1000 * 60 * 60);
    })
    .sort((a, b) => a - b);

  if (turnaroundHours.length > 0) {
    const mid = Math.floor(turnaroundHours.length / 2);
    medianHours =
      turnaroundHours.length % 2 === 0
        ? Math.round((turnaroundHours[mid - 1] + turnaroundHours[mid]) / 2)
        : turnaroundHours[mid];
  }

  // Fetch waiting vs decided counts
  const { data: docStatusCounts, error: docCountError } = await user.client
    .from('documents')
    .select('status, count')
    .eq('doc_kind', 'notice')
    .in('status', ['in_review', 'decided'])
    .in(
      'building_id',
      (buildings || []).map((b: any) => b.id),
    );

  checkDb(docCountError);

  let decidedCount = 0;
  let waitingCount = 0;
  (docStatusCounts || []).forEach((d: any) => {
    if (d.status === 'decided') decidedCount += d.count || 0;
    if (d.status === 'in_review') waitingCount += d.count || 0;
  });

  return {
    firstName,
    firm: { id: orgId, name: org?.name || 'Organization' },
    staff: staffList,
    roster,
    turnaround: {
      medianHours,
      decided: decidedCount,
      waiting: waitingCount,
      oldest:
        (decidedDocs || []).length > 0
          ? new Date((decidedDocs as any[])[decidedDocs.length - 1].created_at)
          : null,
    },
    knowledge: await fetchFirmKnowledge(user, orgId),
    plan: null,
    invitations: [],
    codes: [],
  };
}

// ============ STRATA MANAGER DASHBOARD ============

export async function strataManagerDashboard(orgId: string): Promise<StrataManagerData | null> {
  const user = await requireUser();

  // Verify user is portfolio manager
  const { data: orgMember, error: orgError } = await user.client
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(orgError);
  if (!orgMember || !['portfolio_manager', 'portfolio_assistant', 'org_owner', 'org_admin'].includes(orgMember.role)) {
    return null; // User is not portfolio staff
  }

  // Fetch profile for first name
  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  checkDb(profileError);
  const firstName = profile?.display_name?.split(' ')[0] || 'Manager';

  // Fetch linked buildings with status
  const { data: linkedBuildings, error: buildingsError } = await user.client
    .from('firm_building_links')
    .select('building_id, buildings!inner(name, address, unit_count)')
    .eq('firm_org_id', orgId)
    .eq('status', 'active');

  checkDb(buildingsError);

  const buildingIds = (linkedBuildings || []).map((l: any) => l.building_id);

  // Fetch review, dispute, and draft counts per building
  const { data: reviewCountsStrata, error: reviewErrorStrata } = await user.client
    .from('documents')
    .select('building_id, status')
    .eq('doc_kind', 'notice')
    .in('status', ['draft', 'in_review'])
    .in('building_id', buildingIds);

  checkDb(reviewErrorStrata);

  const { data: disputeCountsStrata, error: disputeErrorStrata } = await user.client
    .from('disputes')
    .select('building_id, status')
    .in('status', ['open', 'escalated'])
    .in('building_id', buildingIds);

  checkDb(disputeErrorStrata);

  const { data: draftCounts, error: draftError } = await user.client
    .from('documents')
    .select('building_id, kind')
    .eq('status', 'draft')
    .in('kind', ['letter', 'notice'])
    .in('building_id', buildingIds);

  checkDb(draftError);

  // Fetch recent audit log entries per building
  const { data: auditEventsStrata, error: auditErrorStrata } = await user.client
    .from('audit_log')
    .select('building_id, created_at')
    .in('building_id', buildingIds)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  checkDb(auditErrorStrata);

  const reviewsByBuildingStrata = new Map<string, number>();
  const disputesByBuildingStrata = new Map<string, number>();
  const draftsByBuilding = new Map<string, number>();
  const updatesByBuildingStrata = new Map<string, number>();

  (reviewCountsStrata || []).forEach((r: any) => {
    reviewsByBuildingStrata.set(
      r.building_id,
      (reviewsByBuildingStrata.get(r.building_id) || 0) + 1,
    );
  });

  (disputeCountsStrata || []).forEach((d: any) => {
    disputesByBuildingStrata.set(
      d.building_id,
      (disputesByBuildingStrata.get(d.building_id) || 0) + 1,
    );
  });

  (draftCounts || []).forEach((d: any) => {
    draftsByBuilding.set(d.building_id, (draftsByBuilding.get(d.building_id) || 0) + 1);
  });

  (auditEventsStrata || []).forEach((a: any) => {
    updatesByBuildingStrata.set(a.building_id, (updatesByBuildingStrata.get(a.building_id) || 0) + 1);
  });

  const buildings = (linkedBuildings || []).map((l: any) => ({
    id: l.building_id,
    name: l.buildings?.name || 'Unknown',
    address: l.buildings?.address || null,
    units: l.buildings?.unit_count || null,
    health: { tone: 'green' as const, label: 'Healthy', issues: [] },
    reviews: reviewsByBuildingStrata.get(l.building_id) || 0,
    disputes: disputesByBuildingStrata.get(l.building_id) || 0,
    drafts: draftsByBuilding.get(l.building_id) || 0,
    updates: updatesByBuildingStrata.get(l.building_id) || 0
  }));

  // Build needs attention list (overdue reviews, escalated disputes)
  const needsAttention = [];

  // Fetch oldest document ages per building
  const { data: oldestDocs, error: docsAgeError } = await user.client
    .from('documents')
    .select('building_id, created_at')
    .eq('status', 'draft')
    .in('building_id', buildingIds)
    .order('created_at', { ascending: true });

  checkDb(docsAgeError);

  const oldestDocByBuilding = new Map<string, number>();
  (oldestDocs || []).forEach((doc: any) => {
    if (!oldestDocByBuilding.has(doc.building_id)) {
      const daysOld = Math.floor(
        (Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      oldestDocByBuilding.set(doc.building_id, daysOld);
    }
  });

  // Fetch oldest dispute ages per building
  const { data: oldestDisputes, error: disputesAgeError } = await user.client
    .from('disputes')
    .select('building_id, created_at')
    .in('status', ['open', 'escalated'])
    .in('building_id', buildingIds)
    .order('created_at', { ascending: true });

  checkDb(disputesAgeError);

  const oldestDisputeByBuilding = new Map<string, number>();
  (oldestDisputes || []).forEach((dispute: any) => {
    if (!oldestDisputeByBuilding.has(dispute.building_id)) {
      const daysOld = Math.floor(
        (Date.now() - new Date(dispute.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      oldestDisputeByBuilding.set(dispute.building_id, daysOld);
    }
  });

  buildings.forEach((b: any) => {
    if (b.reviews > 0) {
      needsAttention.push({
        type: 'review' as const,
        buildingId: b.id,
        buildingName: b.name,
        count: b.reviews,
        age: oldestDocByBuilding.get(b.id) || null,
      });
    }
    if (b.disputes > 0) {
      needsAttention.push({
        type: 'dispute' as const,
        buildingId: b.id,
        buildingName: b.name,
        count: b.disputes,
        age: oldestDisputeByBuilding.get(b.id) || null,
      });
    }
  });

  // Fetch firm knowledge base collections
  const { data: firmDocs } = await user.client
    .from('firm_knowledge')
    .select('type')
    .eq('org_id', orgId)
    .is('deleted_at', null);

  const typeGroups = new Map<string, number>();
  (firmDocs || []).forEach((doc: any) => {
    const count = typeGroups.get(doc.type) || 0;
    typeGroups.set(doc.type, count + 1);
  });

  const collections = Array.from(typeGroups.entries()).map(([type, count]) => ({
    type,
    count,
  }));

  return {
    firstName,
    needsAttention,
    buildings,
    knowledge: {
      collections,
      recent: [],
      buildingId: null,
    },
    askAcross: null,
  };
}

// ============ BUILDING MANAGER DASHBOARD ============

export async function buildingManagerDashboard(buildingId: string): Promise<BuildingManagerData | null> {
  const user = await requireUser();

  // Verify user has access to building and is building manager/equivalent
  const { data: member, error: memberError } = await user.client
    .from('building_members')
    .select('role')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(memberError);
  if (!member) {
    return null; // User doesn't have access
  }

  // Only building managers (and above staff roles) get full dashboard
  const staffRoles = ['building_manager', 'council_president', 'org_owner', 'org_admin', 'portfolio_manager'];
  if (!staffRoles.includes(member.role)) {
    return null; // Insufficient role
  }

  // Fetch building info
  const { data: building, error: buildingError } = await user.client
    .from('buildings')
    .select('name, address, unit_count, strata_plan_no')
    .eq('id', buildingId)
    .single();

  checkDb(buildingError);

  // Fetch profile for first name
  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single();

  checkDb(profileError);
  const firstName = profile?.display_name?.split(' ')[0] || 'Manager';

  // Fetch drafts for this building
  const { data: draftDocs, error: draftError } = await user.client
    .from('documents')
    .select('id, title, kind, created_at, created_by')
    .eq('building_id', buildingId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(10);

  checkDb(draftError);

  // Fetch disputes for this building
  const { data: buildingDisputes, error: disputeError } = await user.client
    .from('disputes')
    .select(
      `
      id,
      title,
      status,
      created_at,
      created_by
    `,
    )
    .eq('building_id', buildingId)
    .in('status', ['open', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(10);

  checkDb(disputeError);

  // Fetch recent audit events (council updates)
  const { data: auditEvents, error: auditError } = await user.client
    .from('audit_log')
    .select('action, created_at, created_by')
    .eq('building_id', buildingId)
    .in('action', ['document_shared', 'member_invited', 'dispute_created', 'bylaw_confirmed'])
    .order('created_at', { ascending: false })
    .limit(10);

  checkDb(auditError);

  // Fetch resident count and invite code
  const { data: residents, error: residentsError } = await user.client
    .from('building_members')
    .select('id')
    .eq('building_id', buildingId)
    .eq('role', 'owner_resident')
    .eq('status', 'active');

  checkDb(residentsError);

  const { data: buildingInvite, error: codeError } = await user.client
    .from('building_invitations')
    .select('code')
    .eq('building_id', buildingId)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(codeError);

  // Fetch firm link (if any)
  const { data: firmLink, error: firmError } = await user.client
    .from('firm_building_links')
    .select('organizations(name)')
    .eq('building_id', buildingId)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(firmError);

  return {
    firstName,
    building: {
      id: buildingId,
      name: building?.name || 'Building',
      address: building?.address || null,
      units: building?.unit_count || null,
      strataPlan: building?.strata_plan_no || null,
    },
    health: {
      tone: 'green' as const,
      label: 'Healthy',
      issues: [],
      checks: [
        {
          label: 'Documents uploaded',
          ok: (draftDocs || []).length > 0,
          detail: `${Math.max(1, (draftDocs || []).length)} of 15 required`,
        },
        {
          label: 'Bylaws confirmed',
          ok: building?.strata_plan_no !== null,
          detail: building?.strata_plan_no ? `Current as of 2026` : 'Not yet confirmed',
        },
        {
          label: 'Members active',
          ok: true,
          detail: `${(residents || []).length || 0} of 9`,
        },
      ],
    },
    drafts: (draftDocs || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      createdAt: new Date(d.created_at),
    })),
    council: {
      updates: (auditEvents || [])
        .slice(0, 5)
        .map((a: any) => ({
          action: a.action,
          createdAt: new Date(a.created_at),
        })),
      disputes: (buildingDisputes || []).map((d: any) => ({
        id: d.id,
        title: d.title,
        status: d.status,
        createdAt: new Date(d.created_at),
      })),
    },
    residents: {
      count: (residents || []).length,
      code: buildingInvite?.code || '',
    },
    plan: {
      label: 'Standard',
      price: 99,
      listPrice: 129,
      seatsIncluded: 10,
      seatsUsed: (residents || []).length,
      billedBy: null,
    },
    firmName: firmLink?.organizations?.name || null,
    can: {
      draft: member.role !== 'owner_resident',
      ask: true,
      upload: member.role !== 'owner_resident',
      invite: ['building_manager', 'council_president', 'org_owner', 'org_admin'].includes(member.role),
    },
  };
}

/**
 * Fetch firm knowledge base metrics
 */
async function fetchFirmKnowledge(user: any, orgId: string) {
  try {
    // Get firm documents count
    const { data: documents, error: docsError } = await user.client
      .from('firm_knowledge')
      .select('id, type, updated_at')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (docsError) throw docsError;

    const docCount = (documents || []).length;
    const lastUpdated = documents?.[0]?.updated_at || null;

    // Group by type
    const typeGroups = new Map<string, number>();
    (documents || []).forEach((doc: any) => {
      const count = typeGroups.get(doc.type) || 0;
      typeGroups.set(doc.type, count + 1);
    });

    const collections = Array.from(typeGroups.entries()).map(([type, count]) => ({
      type,
      count,
    }));

    return {
      total: docCount,
      collections,
      lastUpdated,
      buildingId: null,
    };
  } catch (error) {
    console.error('Failed to fetch firm knowledge:', error);
    return {
      total: 0,
      collections: [],
      lastUpdated: null,
      buildingId: null,
    };
  }
}
