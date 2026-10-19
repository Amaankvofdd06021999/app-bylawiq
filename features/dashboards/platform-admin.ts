import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import type { PlatformAdminData } from './types';

export async function isPlatformAdminUser(user: SessionUser): Promise<boolean> {
  const { data: status } = await user.client.rpc('platform_admin_status');
  if (status && status[0]?.is_platform_admin) return true;

  const { data: member } = await user.client
    .from('org_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('role', 'platform_admin')
    .eq('status', 'active')
    .maybeSingle();

  return Boolean(member);
}

export async function platformAdminHome(
  user: SessionUser,
): Promise<{ name: string; data: PlatformAdminData } | null> {
  if (!(await isPlatformAdminUser(user))) return null;

  const { data: profile } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  const name = profile?.display_name || 'Admin';

  const [buildingsRes, orgsRes, docsRes, flagsRes, auditRes, qaRes] = await Promise.all([
    user.client.from('buildings').select('id, name, created_at, unit_count').is('deleted_at', null),
    user.client.from('organizations').select('id, name, kind, created_at').order('name'),
    user.client.from('documents').select('id, status, type, structure_confirmed').is('deleted_at', null),
    user.client.from('feature_flags').select('flag_name, enabled'),
    user.client
      .from('platform_audit_log')
      .select('id, action, resource_name, occurred_at')
      .order('occurred_at', { ascending: false })
      .limit(10),
    user.client.from('resident_audit_log').select('id, created_at, action, building_id').limit(100),
  ]);

  const buildings = buildingsRes.data || [];
  const orgs = orgsRes.data || [];
  const docs = docsRes.data || [];
  const flags = flagsRes.data || [];
  const audits = auditRes.data || [];
  const qa = qaRes.data || [];

  const residentAiFlag = flags.find((f) => f.flag_name === 'residentAi')?.enabled ?? true;
  const now = new Date();
  const month = now.toISOString().slice(0, 7);

  const customers = [
    ...orgs
      .filter((o) => o.kind === 'firm')
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: 'firm' as const,
        plan: 'Professional Firm',
        listPrice: 499,
        price: 399,
        launchDiscount: true,
        seatsUsed: 3,
        seatsIncluded: 10,
        mrr: 399,
        status: 'active' as const,
        billedTo: null,
        since: f.created_at ? f.created_at.slice(0, 10) : '2026-09-01',
      })),
    ...buildings.map((b) => ({
      id: b.id,
      name: b.name,
      kind: 'building' as const,
      plan: 'Standard Strata',
      listPrice: 199,
      price: 149,
      launchDiscount: true,
      seatsUsed: 2,
      seatsIncluded: 5,
      mrr: 149,
      status: 'active' as const,
      billedTo: null,
      since: b.created_at ? b.created_at.slice(0, 10) : '2026-09-01',
    })),
  ];

  const paying = customers.filter((c) => c.mrr > 0);
  const questionsCount = qa.filter((q) => q.action === 'resident_question').length;
  const noGroundingCount = qa.filter((q) => q.action === 'verification_failed').length;

  const data: PlatformAdminData = {
    month,
    revenue: {
      mrr: paying.reduce((n, c) => n + c.mrr, 0),
      listMrr: paying.reduce((n, c) => n + c.listPrice, 0),
      launchMrr: paying.filter((c) => c.launchDiscount).reduce((n, c) => n + c.mrr, 0),
      launchCustomers: paying.filter((c) => c.launchDiscount).length,
      creditSales: questionsCount * 1,
      payingCustomers: paying.length,
      trials: 0,
    },
    customers,
    usage: {
      questions: questionsCount,
      noGrounding: noGroundingCount,
      noGroundingRate: questionsCount ? noGroundingCount / questionsCount : 0,
      estCostUsd: questionsCount * 0.02,
      top: buildings.slice(0, 5).map((b) => {
        const bQs = qa.filter((q) => q.building_id === b.id && q.action === 'resident_question').length;
        const bNg = qa.filter((q) => q.building_id === b.id && q.action === 'verification_failed').length;
        return {
          buildingId: b.id,
          name: b.name,
          questions: bQs,
          noGroundingRate: bQs ? bNg / bQs : 0,
        };
      }),
    },
    knowledge: {
      failed: docs.filter((d) => d.status === 'failed').length,
      processing: docs.filter((d) =>
        ['uploaded', 'scanning', 'parsing', 'chunking', 'embedding'].includes(String(d.status)),
      ).length,
      awaitingReview: docs.filter((d) => d.status === 'review').length,
      bylawsUnconfirmed: docs.filter((d) => d.type === 'bylaws' && !d.structure_confirmed).length,
      legalPassages: 154,
      legalUpdatedAt: new Date().toISOString(),
    },
    flags: { residentAi: residentAiFlag },
    audit: audits.map((a) => ({
      id: a.id,
      at: a.occurred_at,
      actor: 'Admin',
      summary: a.action + (a.resource_name ? ` (${a.resource_name})` : ''),
    })),
  };

  return { name, data };
}
