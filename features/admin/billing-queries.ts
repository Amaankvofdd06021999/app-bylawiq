import { createClient } from '@/lib/supabase/server';

export interface BillingAccount {
  orgId: string;
  plan: 'pilot' | 'building' | 'building_pro' | 'strata_manager' | 'enterprise';
  seats: number;
  launchDiscount: boolean;
  status: 'active' | 'past_due' | 'cancelled';
  monthlyTotal: number;
  baseCost: number;
  seatCost: number;
  nextBillingDate: string | null;
}

export interface PlanDetails {
  name: string;
  description: string;
  baseCost: number;
  includedSeats: number;
  seatCost: number;
  contactOnly: boolean;
  features: string[];
}

/**
 * Get billing account for the current organization
 */
export async function getBillingAccount(): Promise<BillingAccount | null> {
  const db = await createClient();

  const { data: orgMember } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', (await db.auth.getUser()).data.user?.id)
    .single();

  if (!orgMember) return null;

  const { data: billing } = await db
    .from('billing_accounts')
    .select('plan, seats, launch_discount, status, billing_cycle_start, created_at')
    .eq('org_id', orgMember.org_id)
    .single();

  if (!billing) return null;

  const pricing = getPricing(billing.plan);
  const nextBillingDate = calculateNextBillingDate(
    billing.billing_cycle_start || billing.created_at,
    billing.status
  );

  return {
    orgId: orgMember.org_id,
    plan: billing.plan,
    seats: billing.seats,
    launchDiscount: billing.launch_discount,
    status: billing.status,
    baseCost: pricing.baseCost,
    seatCost: pricing.seatCost,
    monthlyTotal: calculateMonthlyTotal(billing.seats, pricing, billing.launch_discount),
    nextBillingDate,
  };
}

/**
 * Get seat utilization (current active members)
 */
export async function getSeatUtilization(): Promise<number> {
  const db = await createClient();

  const { data: orgMember } = await db
    .from('org_members')
    .select('org_id')
    .eq('user_id', (await db.auth.getUser()).data.user?.id)
    .single();

  if (!orgMember) return 0;

  const { data: buildingMembers, error } = await db
    .from('building_members')
    .select('id', { count: 'exact' })
    .in('building_id', [
      ...((await db.from('buildings').select('id').eq('org_id', orgMember.org_id)).data || []),
    ])
    .neq('role', 'owner_resident')
    .eq('status', 'active');

  return buildingMembers?.length || 0;
}

/**
 * Get plan pricing information
 */
function getPricing(plan: string): { baseCost: number; seatCost: number } {
  const pricing: Record<string, { baseCost: number; seatCost: number }> = {
    pilot: { baseCost: 0, seatCost: 0 },
    building: { baseCost: 9900, seatCost: 4000 }, // $99/mo, $40/mo per seat
    building_pro: { baseCost: 29900, seatCost: 0 },
    strata_manager: { baseCost: 19900, seatCost: 0 },
    enterprise: { baseCost: 0, seatCost: 0 },
  };

  return pricing[plan] || { baseCost: 0, seatCost: 0 };
}

/**
 * Calculate monthly total cost
 */
function calculateMonthlyTotal(seats: number, pricing: { baseCost: number; seatCost: number }, launchDiscount: boolean): number {
  let base = pricing.baseCost;
  if (launchDiscount) {
    base = Math.floor(base * 0.5); // 50% off for launch discount
  }
  return base + seats * pricing.seatCost;
}

/**
 * Calculate next billing date (30 days from cycle start or creation)
 */
function calculateNextBillingDate(cycleStartDate: string | null, status: string): string | null {
  if (!cycleStartDate || status === 'cancelled') return null;

  const startDate = new Date(cycleStartDate);
  const nextDate = new Date(startDate);
  nextDate.setMonth(nextDate.getMonth() + 1);

  // If next date is in the past, add another month
  if (nextDate < new Date()) {
    nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

/**
 * Get plan details
 */
export const PLAN_DETAILS: Record<string, PlanDetails> = {
  pilot: {
    name: 'Pilot',
    description: 'Free plan for testing',
    baseCost: 0,
    includedSeats: 0,
    seatCost: 0,
    contactOnly: false,
    features: ['Building setup', 'Document management', 'Basic chat'],
  },
  building: {
    name: 'Building',
    description: 'For single buildings',
    baseCost: 9900,
    includedSeats: 3,
    seatCost: 4000,
    contactOnly: false,
    features: [
      'Up to 3 seats included',
      'Full document management',
      'AI-powered chat',
      'Dispute tracking',
      'Council notices',
    ],
  },
  building_pro: {
    name: 'Building Pro',
    description: 'Advanced features for buildings',
    baseCost: 29900,
    includedSeats: 10,
    seatCost: 0,
    contactOnly: false,
    features: [
      '10 seats included',
      'All Building features',
      'Violation letters',
      'Priority support',
      'Custom branding',
    ],
  },
  strata_manager: {
    name: 'Strata Manager',
    description: 'For management firms',
    baseCost: 19900,
    includedSeats: 20,
    seatCost: 0,
    contactOnly: false,
    features: [
      'Multi-building management',
      'Unlimited portfolio',
      'Team collaboration',
      'Audit trails',
      'Priority support',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    description: 'Custom solutions',
    baseCost: 0,
    includedSeats: 0,
    seatCost: 0,
    contactOnly: true,
    features: [
      'Unlimited buildings',
      'Custom features',
      'Dedicated support',
      'SLA guarantee',
      'Custom integrations',
    ],
  },
};
