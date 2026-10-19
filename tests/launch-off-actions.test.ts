import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  createClient: vi.fn(),
  stripeConstructor: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/guards', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }));
vi.mock('stripe', () => ({
  default: class {
    checkout = { sessions: { create: vi.fn() } };
    constructor(key: string) {
      mocks.stripeConstructor(key);
    }
  },
}));

import { updateSeatsAction } from '@/features/admin/billing-actions';
import { createCreditCheckoutAction } from '@/features/residents/checkout-actions';
import { createBulletinPostAction, deleteBulletinPostAction } from '@/features/bulletin/bulletin-actions';
import { createResidentDraftAction } from '@/features/residents/draft-actions';

const BUILDING_ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({
    id: 'user-1',
    email: 'user@example.com',
    client: {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  });
});

describe('actions proceed to user authentication and execution', () => {
  it('updateSeatsAction checks user authorization', async () => {
    await updateSeatsAction({ seats: 10 });
    expect(mocks.requireUser).toHaveBeenCalled();
  });

  it('createCreditCheckoutAction requires user authentication', async () => {
    await createCreditCheckoutAction({ buildingId: BUILDING_ID });
    expect(mocks.requireUser).toHaveBeenCalled();
  });

  it('createBulletinPostAction requires user authentication', async () => {
    await createBulletinPostAction({ buildingId: BUILDING_ID, title: 'Notice', body: 'Body' });
    expect(mocks.requireUser).toHaveBeenCalled();
  });

  it('deleteBulletinPostAction requires user authentication', async () => {
    await deleteBulletinPostAction({ postId: BUILDING_ID });
    expect(mocks.requireUser).toHaveBeenCalled();
  });

  it('createResidentDraftAction requires user authentication', async () => {
    await createResidentDraftAction({ buildingId: BUILDING_ID, kind: 'letter_reply' });
    expect(mocks.requireUser).toHaveBeenCalled();
  });
});
