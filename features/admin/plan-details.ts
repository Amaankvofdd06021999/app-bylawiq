// Plan catalogue: plain data, so client components can show it without importing server queries.

export interface PlanDetails {
  name: string;
  description: string;
  baseCost: number;
  includedSeats: number;
  seatCost: number;
  contactOnly: boolean;
  features: string[];
}

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
