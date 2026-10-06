// Prop types for the role home screens. Each screen gets plain, already-scoped data: the page that renders it
// (demo: `mock/dashboards.ts`) decides what the person may see, so these components never fetch anything.
export type Tone = 'neutral' | 'green' | 'warning' | 'red' | 'blue';
/** A building's at-a-glance state: green when nothing needs doing, warning with open items, red when overdue. */
export type Health = { tone: 'green' | 'warning' | 'red'; label: string; issues: string[] };
export type CollectionSummary = { id: string; label: string; count: number };

export type PlatformAdminData = {
  month: string;
  revenue: {
    mrr: number;
    listMrr: number;
    launchMrr: number;
    launchCustomers: number;
    creditSales: number;
    payingCustomers: number;
    trials: number;
  };
  customers: {
    id: string;
    name: string;
    kind: 'firm' | 'building';
    plan: string;
    listPrice: number;
    price: number;
    launchDiscount: boolean;
    seatsUsed: number;
    seatsIncluded: number;
    mrr: number;
    status: 'active' | 'trial';
    billedTo: string | null;
    since: string;
  }[];
  usage: {
    questions: number;
    estCostUsd: number;
    noGrounding: number;
    noGroundingRate: number;
    top: { buildingId: string; name: string; questions: number; noGroundingRate: number }[];
  };
  knowledge: {
    failed: number;
    processing: number;
    awaitingReview: number;
    bylawsUnconfirmed: number;
    legalPassages: number;
    legalUpdatedAt: string | null;
  };
  flags: { residentAi: boolean };
  audit: { id: string; at: string; actor: string; summary: string }[];
};

export type FirmOwnerData = {
  firstName: string;
  firm: { id: string; name: string };
  staff: {
    userId: string;
    name: string;
    role: string;
    buildings: number;
    openReviews: number;
    lastActive: string | null;
    you: boolean;
  }[];
  roster: {
    buildingId: string;
    name: string;
    linked: boolean;
    since: string | null;
    health: Health;
    openDisputes: number;
    pendingReviews: number;
  }[];
  turnaround: {
    medianHours: number | null;
    decided: number;
    waiting: number;
    oldest: { id: string; title: string; buildingId: string; buildingName: string; days: number } | null;
  };
  knowledge: {
    total: number;
    collections: CollectionSummary[];
    lastUpdated: string | null;
    buildingId: string | null;
  };
  plan: {
    label: string;
    listPrice: number;
    price: number;
    launchDiscount: boolean;
    seatsIncluded: number;
    seatsUsed: number;
    buildings: number;
    status: string;
  } | null;
  invitations: {
    id: string;
    buildingId: string;
    buildingName: string;
    email: string;
    role: string;
    expiresAt: string;
  }[];
  codes: { id: string; buildingId: string; buildingName: string; expiresAt: string }[];
};

export type AttentionKind = 'review' | 'deadline' | 'unsent' | 'law';
export type AttentionItem = {
  id: string;
  kind: AttentionKind;
  title: string;
  detail: string;
  buildingId: string | null;
  buildingName: string | null;
  section: string;
  tone: Tone;
};
export type StrataManagerData = {
  firstName: string;
  needsAttention: AttentionItem[];
  buildings: {
    id: string;
    name: string;
    address: string | null;
    units: number | null;
    health: Health;
    reviews: number;
    disputes: number;
    drafts: number;
    updates: number;
  }[];
  knowledge: {
    collections: CollectionSummary[];
    recent: { id: string; title: string; collection: string }[];
    buildingId: string | null;
  } | null;
  askAcross: { buildingId: string; count: number } | null;
};

export type DraftStatus = 'draft' | 'pending_review' | 'changes_requested' | 'approved' | 'sent';
export type BuildingManagerData = {
  firstName: string;
  building: {
    id: string;
    name: string;
    address: string | null;
    units: number | null;
    strataPlan: string | null;
  };
  health: Health & { checks: { label: string; ok: boolean; detail: string }[] };
  drafts: {
    id: string;
    title: string;
    kind: string;
    status: DraftStatus;
    reviewBy: string;
    note: string | null;
    updatedAt: string;
  }[];
  council: {
    updates: { id: string; title: string; severity: string; at: string }[];
    disputes: {
      id: string;
      title: string;
      reference: string;
      stage: string;
      deadline: string | null;
      deadlineLabel: string | null;
    }[];
  };
  residents: { count: number; code: string };
  plan: {
    label: string;
    price: number;
    listPrice: number;
    seatsIncluded: number;
    seatsUsed: number;
    billedBy: string | null;
  };
  firmName: string | null;
  can: { draft: boolean; ask: boolean; upload: boolean; invite: boolean };
};
