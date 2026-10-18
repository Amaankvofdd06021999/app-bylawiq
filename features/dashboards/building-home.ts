import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { unfiledSeverity } from '@/lib/lto-filing';
import { checkDb } from '@/lib/errors';
import type { BuildingManagerData } from './types';

/** Stages after which a dispute is no longer open. Matches the stages accepted by log_dispute_event. */
const CLOSED_DISPUTE_STAGES = '(resolved,withdrawn)';

async function allowed(user: SessionUser, permission: string, buildingId: string): Promise<boolean> {
  const { data, error } = await user.client.rpc('authorize', {
    p_permission: permission,
    p_building: buildingId,
  });
  checkDb(error);
  return data === true;
}

/**
 * The building manager's home, from the database and through the caller's own client, so RLS decides every row.
 * Returns null when the caller cannot read the building, which the screen treats as "no home here".
 */
export async function buildingManagerHome(
  user: SessionUser,
  buildingId: string,
): Promise<BuildingManagerData | null> {
  if (!(await allowed(user, 'building.read', buildingId))) return null;

  const { data: building, error: buildingError } = await user.client
    .from('buildings')
    .select('id,name,address,unit_count,strata_plan_no')
    .eq('id', buildingId)
    .is('deleted_at', null)
    .maybeSingle();
  checkDb(buildingError);
  if (!building) return null;

  const { data: documents, error: documentError } = await user.client
    .from('documents')
    .select('status')
    .eq('building_id', buildingId)
    .is('deleted_at', null);
  checkDb(documentError);
  const statusCount = (status: string) => (documents ?? []).filter((d) => d.status === status).length;
  const ready = statusCount('ready');
  const review = statusCount('review');
  const failed = statusCount('failed');

  const { data: disputes, error: disputeError } = await user.client
    .from('disputes')
    .select('id,title,reference,stage')
    .eq('building_id', buildingId)
    .is('deleted_at', null)
    .not('stage', 'in', CLOSED_DISPUTE_STAGES)
    .order('created_at', { ascending: false })
    .limit(20);
  checkDb(disputeError);

  const { count: residentCount, error: residentError } = await user.client
    .from('building_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('building_id', buildingId)
    .eq('role', 'owner_resident')
    .eq('status', 'active');
  checkDb(residentError);

  // Updates are the building's open notifications (for example, an adopted bylaw that still needs its filing record).
  // Snoozed, dismissed and actioned notifications are not shown. Written by the database, read through RLS.
  const { data: notes, error: noteError } = await user.client
    .from('notifications')
    .select('id,type,title,severity,created_at')
    .eq('building_id', buildingId)
    .in('state', ['new', 'viewed'])
    .order('created_at', { ascending: false })
    .limit(10);
  checkDb(noteError);

  const { data: profile, error: profileError } = await user.client
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .maybeSingle();
  checkDb(profileError);

  const issues: string[] = [];
  if (failed > 0)
    issues.push(
      `${failed} upload${failed === 1 ? '' : 's'} failed. Open the document to see why, then retry.`,
    );
  if (review > 0)
    issues.push(`${review} document${review === 1 ? '' : 's'} waiting for you to confirm the structure.`);
  const tone = failed > 0 ? 'red' : review > 0 ? 'warning' : 'green';
  const label = failed > 0 ? 'Needs attention' : review > 0 ? 'Waiting for confirmation' : 'In order';

  const [canAsk, canUpload, canInvite] = await Promise.all([
    allowed(user, 'chat.use', buildingId),
    allowed(user, 'vault.upload', buildingId),
    allowed(user, 'member.invite', buildingId),
  ]);

  return {
    firstName: (profile?.display_name ?? '').split(' ')[0] || 'there',
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
      units: building.unit_count,
      strataPlan: building.strata_plan_no,
    },
    health: {
      tone,
      label,
      issues,
      checks: [
        { label: 'Documents ready for Ask', ok: ready > 0, detail: `${ready} ready` },
        { label: 'No failed uploads', ok: failed === 0, detail: failed === 0 ? 'None' : `${failed} failed` },
        {
          label: 'Waiting for confirmation',
          ok: review === 0,
          detail: review === 0 ? 'None' : `${review} waiting`,
        },
      ],
    },
    council: {
      updates: (notes ?? []).map((n) => ({
        id: n.id,
        title: n.title,
        // An unfiled-filing notice escalates on the schedule in lib/lto-filing.ts, shown now and not only after the nightly refresh.
        severity: n.type === 'unfiled_adoption' ? unfiledSeverity(n.created_at) : n.severity,
        at: n.created_at,
      })),
      disputes: (disputes ?? []).map((d) => ({
        id: d.id,
        title: d.title,
        reference: d.reference,
        stage: d.stage,
      })),
    },
    residents: { count: residentCount ?? 0 },
    firmName: null,
    can: { draft: false, ask: canAsk, upload: canUpload, invite: canInvite },
  };
}
