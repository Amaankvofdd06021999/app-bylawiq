import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { nextMfaStep } from '@/lib/auth/mfa-flow';
import { readPlatformAdminStatus } from '@/features/admin/mfa/status';
import { MfaSetup } from '@/features/admin/mfa/components/mfa-setup';

export default async function PlatformMfaPage() {
  const user = await requireUser();
  const status = await readPlatformAdminStatus(user);
  const step = nextMfaStep(status);
  if (step === 'forbidden') redirect('/');
  if (step === 'done') redirect('/admin/platform');

  return (
    <div className="page-container">
      <MfaSetup mode={step} verifiedFactorId={status.verifiedFactorId} />
    </div>
  );
}
