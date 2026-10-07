import 'server-only';
import { requireUser } from '@/lib/auth/guards';
import { checkDb } from '@/lib/errors';
import type { ResidentHome } from './types';

export async function residentHome(buildingId: string): Promise<ResidentHome | null> {
  const user = await requireUser();

  // Verify user is resident in this building
  const { data: member, error: memberError } = await user.client
    .from('building_members')
    .select('role')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  checkDb(memberError);
  if (!member || member.role !== 'owner_resident') {
    return null;
  }

  // Fetch building info
  const { data: building, error: buildingError } = await user.client
    .from('buildings')
    .select('id, name')
    .eq('id', buildingId)
    .single();

  checkDb(buildingError);

  // Fetch resident's wallet
  const { data: wallet, error: walletError } = await user.client
    .from('resident_wallets')
    .select('credits, lifetime_purchased, lifetime_spent')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .maybeSingle();

  checkDb(walletError);

  // Fetch recent questions (chats)
  const { data: chats, error: chatsError } = await user.client
    .from('chats')
    .select('id, title, created_at')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  checkDb(chatsError);

  // Fetch recent transaction history
  const { data: transactions, error: transactionsError } = await user.client
    .from('wallet_transactions')
    .select('id, kind, amount, reason, created_at')
    .eq('wallet_id', wallet?.id || '')
    .order('created_at', { ascending: false })
    .limit(10);

  checkDb(transactionsError);

  // Fetch available FAQ/resources
  const { data: resources, error: resourcesError } = await user.client
    .from('documents')
    .select('id, title')
    .eq('building_id', buildingId)
    .eq('doc_kind', 'faq')
    .order('title')
    .limit(10);

  checkDb(resourcesError);

  return {
    building: {
      id: building?.id || buildingId,
      name: building?.name || 'Building',
    },
    wallet: {
      credits: wallet?.credits || 0,
      lifetimePurchased: wallet?.lifetime_purchased || 0,
      lifetimeSpent: wallet?.lifetime_spent || 0,
    },
    recentQuestions: (chats || []).map((c: any) => ({
      id: c.id,
      title: c.title,
      askedAt: new Date(c.created_at),
    })),
    transactionHistory: (transactions || []).map((t: any) => ({
      id: t.id,
      kind: t.kind,
      amount: t.amount,
      reason: t.reason,
      createdAt: new Date(t.created_at),
    })),
    resources: (resources || []).map((r: any) => ({
      id: r.id,
      title: r.title,
    })),
  };
}
