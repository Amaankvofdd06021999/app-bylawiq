import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { nextMfaStep } from '@/lib/auth/mfa-flow';
import { readPlatformAdminStatus } from '@/features/admin/mfa/status';
import { RegionalKbViewer } from '@/features/platform-admin/components/regional-kb-viewer';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Regional Knowledge Bases | BylawIQ' };

export default async function AdminRegionalKbPage() {
  const user = await requireUser();
  const step = nextMfaStep(await readPlatformAdminStatus(user));
  if (step === 'forbidden') redirect('/');
  if (step !== 'done') redirect('/admin/platform/mfa');

  return (
    <div className="page-container" style={{ maxWidth: 1200, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
          Regional Knowledge Bases
        </h1>
        <p style={{ color: 'var(--muted, #64748b)', margin: 0 }}>
          Inspect regional corpus chunks, building bylaws, and cross-jurisdiction legal citations.
        </p>
      </div>
      <RegionalKbViewer />
    </div>
  );
}
