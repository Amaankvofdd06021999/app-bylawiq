import 'server-only';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import { CREDIT_PACK, PRICES } from './pricing';
import type { CreditEntry, ResidentData, ResidentDraftView } from './types';

const LEDGER_LABEL: Record<string, string> = {
  purchase: 'Bought credits',
  question: 'Question',
  draft_notice: 'Notice to council',
  letter_reply: 'Reply to a strata letter',
};

const DraftRow = z.object({
  id: z.uuid(),
  kind: z.enum(['notice_to_council', 'letter_reply']),
  title: z.string(),
  body: z.string(),
  meaning: z.array(z.string()),
  sources: z.array(
    z.object({
      kind: z.enum(['building', 'legal']),
      title: z.string(),
      sectionRef: z.string().nullable(),
      content: z.string(),
      citation: z.string().nullable(),
    }),
  ),
  created_at: z.string(),
});

export async function residentHome(buildingId: string): Promise<ResidentData | null> {
  const user = await requireUser();

  const { data: member, error: memberError } = await user.client
    .from('building_members')
    .select('role, unit_number, unit_verified_at')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  checkDb(memberError);
  if (member?.role !== 'owner_resident') return null;

  const [buildingRes, profileRes, flagRes, walletRes, documentsRes, draftsRes] = await Promise.all([
    user.client.from('buildings').select('id, name').eq('id', buildingId).single(),
    user.client.from('profiles').select('display_name').eq('id', user.id).maybeSingle(),
    user.client.from('feature_flags').select('enabled').eq('flag_name', 'residentAi').maybeSingle(),
    user.client
      .from('resident_wallets')
      .select('id, credits')
      .eq('user_id', user.id)
      .eq('building_id', buildingId)
      .maybeSingle(),
    user.client
      .from('documents')
      .select('id, title, type, created_at')
      .eq('building_id', buildingId)
      .eq('status', 'ready')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(20),
    user.client
      .from('resident_drafts')
      .select('id, kind, title, body, meaning, sources, created_at')
      .eq('building_id', buildingId)
      .eq('user_id', user.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .limit(20),
  ]);
  checkDb(buildingRes.error);
  if (!buildingRes.data) return null;
  checkDb(profileRes.error);
  checkDb(flagRes.error);
  checkDb(walletRes.error);
  checkDb(documentsRes.error);
  checkDb(draftsRes.error);

  const walletId = walletRes.data?.id;
  const { data: transactions, error: transactionsError } = walletId
    ? await user.client
        .from('wallet_transactions')
        .select('id, kind, amount, reason, created_at')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
        .limit(20)
    : { data: [], error: null };
  checkDb(transactionsError);

  // Bylaw alerts: the building's in-force bylaws, most recently effective first. Drafts and superseded versions are not
  // visible to residents (RLS: resident_in_force_read).
  const { data: inForce, error: inForceError } = await user.client
    .from('bylaw_versions')
    .select('id, body, effective_date, node_id')
    .eq('building_id', buildingId)
    .eq('status', 'in_force')
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(10);
  checkDb(inForceError);
  const nodeIds = (inForce ?? []).map((v) => v.node_id);
  const { data: sections, error: sectionsError } = nodeIds.length
    ? await user.client.from('bylaw_nodes').select('id, section_ref, title').in('id', nodeIds)
    : { data: [], error: null };
  checkDb(sectionsError);
  const alerts = (inForce ?? []).map((v) => {
    const section = (sections ?? []).find((s) => s.id === v.node_id);
    return {
      id: v.id,
      title: `${section?.section_ref ?? ''} ${section?.title ?? ''}`.trim() || 'Bylaw',
      body: v.body.slice(0, 240),
      at: v.effective_date ?? '',
    };
  });

  const name = profileRes.data?.display_name ?? '';
  const history: CreditEntry[] = (transactions ?? []).map((t) => ({
    id: t.id,
    at: t.created_at,
    label: LEDGER_LABEL[t.reason ?? ''] ?? (t.kind === 'purchase' ? 'Bought credits' : 'Credits used'),
    delta: t.kind === 'purchase' ? Number(t.amount) : -Number(t.amount),
  }));

  const drafts: ResidentDraftView[] = z
    .array(DraftRow)
    .parse(draftsRes.data ?? [])
    .map((d) => ({
      id: d.id,
      kind: d.kind,
      title: d.title,
      body: d.body,
      meaning: d.meaning,
      sources: d.sources,
      createdAt: d.created_at,
    }));

  return {
    firstName: name.split(' ')[0] ?? '',
    name,
    unit: member.unit_number ?? null,
    unitVerified: member.unit_verified_at !== null,
    building: { id: buildingRes.data.id, name: buildingRes.data.name },
    aiOn: flagRes.data?.enabled === true,
    wallet: { credits: Number(walletRes.data?.credits ?? 0), freeLeft: 0, freeTotal: 0 },
    prices: {
      question: PRICES.question,
      draftNotice: PRICES.draftNotice,
      letterReply: PRICES.letterReply,
      pack: { credits: CREDIT_PACK.credits, price: CREDIT_PACK.priceCents / 100 },
    },
    alerts: alerts,
    documents: (documentsRes.data ?? []).map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      at: d.created_at,
    })),
    history,
    drafts,
  };
}
