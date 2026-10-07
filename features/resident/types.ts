export interface ResidentHome {
  building: {
    id: string;
    name: string;
  };
  wallet: {
    credits: number;
    lifetimePurchased: number;
    lifetimeSpent: number;
  };
  recentQuestions: Array<{
    id: string;
    title: string;
    askedAt: Date;
  }>;
  transactionHistory: Array<{
    id: string;
    kind: 'purchase' | 'spend' | 'refund' | 'adjustment';
    amount: number;
    reason: string | null;
    createdAt: Date;
  }>;
  resources: Array<{
    id: string;
    title: string;
  }>;
}
