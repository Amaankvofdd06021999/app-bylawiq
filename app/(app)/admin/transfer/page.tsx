import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { nextMfaStep } from '@/lib/auth/mfa-flow';
import { readPlatformAdminStatus } from '@/features/admin/mfa/status';
import { BuildingTransferWizard } from '@/features/platform-admin/components/building-transfer-wizard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Transfer Building Management | BylawIQ' };

export default async function AdminTransferPage() {
  const user = await requireUser();
  const step = nextMfaStep(await readPlatformAdminStatus(user));
  if (step === 'forbidden') redirect('/');
  if (step !== 'done') redirect('/admin/platform/mfa');

  return (
    <div className="page-container" style={{ maxWidth: 1040, margin: '2rem auto', padding: '0 1rem' }}>
      <BuildingTransferWizard />
    </div>
  );
}
