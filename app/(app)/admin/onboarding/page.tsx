import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { nextMfaStep } from '@/lib/auth/mfa-flow';
import { readPlatformAdminStatus } from '@/features/admin/mfa/status';
import { OnboardingWizard } from '@/features/platform-admin/components/onboarding-wizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Firm Onboarding | BylawIQ' };

export default async function AdminOnboardingPage() {
  const user = await requireUser();
  const step = nextMfaStep(await readPlatformAdminStatus(user));
  if (step === 'forbidden') redirect('/');
  if (step !== 'done') redirect('/admin/platform/mfa');

  return (
    <div className="page-container" style={{ maxWidth: 900, margin: '2rem auto', padding: '0 1rem' }}>
      <OnboardingWizard />
    </div>
  );
}
