import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import type { AttentionItem, Health, StrataManagerData } from './types';

const CLOSED_DISPUTE_STAGES = ['resolved', 'withdrawn'];

/**
 * The strata manager's portfolio: every building the caller can read, with counts from the database. Membership in a
 * firm as a portfolio manager is required; the buildings themselves come from RLS, so a building the caller is not
 * linked to is never returned, whatever id is asked for. Returns null for anyone else.
 */
export async function strataPortfolio(user: SessionUser): Promise<StrataManagerData | null> {
  const { data: membership, error: membershipError } = await user.client
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .eq('role', 'portfolio_manager')
    .eq('status', 'active')
    .limit(1);
  checkDb(membershipError);
  if (!membership?.length) return null;

  const { data: buildings, error: buildingError } = await user.client
    .from('buildings')
    .select('id,name,address,unit_count')
    .is('deleted_at', null)
    .order('name');
  checkDb(buildingError);

  const { data: documents, error: documentError } = await user.client
    .from('documents')
    .select('building_id,status')
    .is('deleted_at', null);
  checkDb(documentError);

  const { data: disputes, error: disputeError } = await user.client
    .from('disputes')
    .select('building_id,stage')
    .is('deleted_at', null)
    .not('stage', 'in', `(${CLOSED_DISPUTE_STAGES.join(',')})`);
  checkDb(disputeError);

  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  checkDb(profileError);

  const rows = (buildings ?? []).map((b) => {
    const docs = (documents ?? []).filter((d) => d.building_id === b.id);
    const reviews = docs.filter((d) => d.status === 'review').length;
    const failed = docs.filter((d) => d.status === 'failed').length;
    const open = (disputes ?? []).filter((d) => d.building_id === b.id).length;
    const issues: string[] = [];
    if (failed > 0) issues.push(`${failed} upload${failed === 1 ? '' : 's'} failed`);
    if (reviews > 0) issues.push(`${reviews} waiting for confirmation`);
    const health: Health = {
      tone: failed > 0 ? 'red' : reviews > 0 ? 'warning' : 'green',
      label: failed > 0 ? 'Needs attention' : reviews > 0 ? 'Waiting for confirmation' : 'In order',
      issues,
    };
    return {
      id: b.id,
      name: b.name,
      address: b.address,
      units: b.unit_count,
      health,
      reviews,
      disputes: open,
    };
  });

  const needsAttention: AttentionItem[] = rows.flatMap((b): AttentionItem[] => {
    const items: AttentionItem[] = [];
    if (b.reviews > 0)
      items.push({
        id: `review-${b.id}`,
        kind: 'review',
        title: `${b.reviews} document${b.reviews === 1 ? '' : 's'} waiting for confirmation`,
        detail: 'Confirm the detected structure so Ask can cite it.',
        buildingId: b.id,
        buildingName: b.name,
        section: 'documents',
        tone: 'warning',
      });
    return items;
  });

  return {
    firstName: (profile?.display_name ?? '').split(' ')[0] || 'there',
    needsAttention,
    buildings: rows.map(({ id, name, address, units, health, reviews, disputes }) => ({
      id,
      name,
      address,
      units,
      health,
      reviews,
      disputes,
    })),
    knowledge: null,
    askAcross: null,
  };
}
