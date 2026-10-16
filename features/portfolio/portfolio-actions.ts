'use server';
import { requireUser } from '@/lib/auth/guards';
import { errorMessage } from '@/lib/errors';
import { getPortfolioAnalytics, getPortfolioDashboard } from './portfolio-queries';

export async function loadPortfolioAction() {
  try {
    const user = await requireUser();
    const [dashboard, analytics] = await Promise.all([
      getPortfolioDashboard(user.id),
      getPortfolioAnalytics(user.id),
    ]);
    return { ok: true as const, dashboard, analytics };
  } catch (e) {
    return { ok: false as const, error: errorMessage(e) };
  }
}
