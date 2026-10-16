import 'server-only';
import { ForbiddenError, checkDb } from '@/lib/errors';
import type { SessionUser } from '@/lib/auth/guards';

/** The resident's credit balance in one building. Throws unless they are an active resident there. */
export async function residentCredits(user: SessionUser, buildingId: string): Promise<number> {
  const { data: resident, error: residentError } = await user.client
    .from('building_members')
    .select('id')
    .eq('building_id', buildingId)
    .eq('user_id', user.id)
    .eq('role', 'owner_resident')
    .eq('status', 'active')
    .maybeSingle();
  checkDb(residentError);
  if (!resident) throw new ForbiddenError('You are not a resident of this building');

  const { data: wallet, error: walletError } = await user.client
    .from('resident_wallets')
    .select('credits')
    .eq('user_id', user.id)
    .eq('building_id', buildingId)
    .maybeSingle();
  checkDb(walletError);
  return wallet?.credits ?? 0;
}
