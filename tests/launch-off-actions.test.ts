import { beforeEach, describe, expect, it, vi } from 'vitest';

// Direct calls to the server actions of every off-for-launch feature. Each action must refuse before it reads the caller,
// touches the database, or contacts Stripe. These tests use the launch flags exactly as shipped (lib/launch-scope.ts).

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
const OFF = 'not available in this release';

beforeEach(() => {
  vi.clearAllMocks();
});

function expectNothingReached() {
  expect(mocks.requireUser).not.toHaveBeenCalled();
  expect(mocks.createClient).not.toHaveBeenCalled();
  expect(mocks.stripeConstructor).not.toHaveBeenCalled();
}

describe('payments are off: billing and checkout actions refuse direct calls', () => {
  it('updateSeatsAction changes nothing and reads nothing', async () => {
    const result = await updateSeatsAction({ seats: 10 });
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain(OFF);
    expectNothingReached();
  });

  it('createCreditCheckoutAction creates no checkout and reads nothing', async () => {
    const result = await createCreditCheckoutAction({ buildingId: BUILDING_ID });
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain(OFF);
    expectNothingReached();
  });

  it('createCreditCheckoutAction stays refused even when a Stripe key is configured', async () => {
    const previous = process.env.STRIPE_SECRET_KEY;
    process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key';
    try {
      const result = await createCreditCheckoutAction({ buildingId: BUILDING_ID });
      expect(result).toMatchObject({ ok: false });
      expectNothingReached();
    } finally {
      if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
      else process.env.STRIPE_SECRET_KEY = previous;
    }
  });
});

describe('bulletin is off: its actions refuse direct calls', () => {
  it('createBulletinPostAction writes nothing and reads nothing', async () => {
    const result = await createBulletinPostAction({ buildingId: BUILDING_ID, title: 'Notice', body: 'Body' });
    expect(result).toMatchObject({ ok: false });
    expect((result as { error: string }).error).toContain(OFF);
    expectNothingReached();
  });

  it('deleteBulletinPostAction writes nothing and reads nothing', async () => {
    const result = await deleteBulletinPostAction({ postId: BUILDING_ID });
    expect(result).toMatchObject({ ok: false });
    expectNothingReached();
  });
});

describe('drafting is off: the action refuses before any read or charge', () => {
  it('createResidentDraftAction returns the unavailable message and reads nothing', async () => {
    const result = await createResidentDraftAction({ buildingId: BUILDING_ID, kind: 'letter_reply' });
    expect(result.ok).toBe(false);
    expectNothingReached();
  });
});
