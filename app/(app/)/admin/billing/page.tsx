import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getBillingAccount, getSeatUtilization } from '@/features/admin/billing-queries';
import { PlanCard } from '@/features/admin/components/plan-card';
import { SeatsStepper } from '@/features/admin/components/seats-stepper';

export default async function AdminBillingPage() {
  const user = await requireUser();

  try {
    const [billing, utilization] = await Promise.all([
      getBillingAccount(),
      getSeatUtilization(),
    ]);

    if (!billing) {
      return <div>No billing information found</div>;
    }

    return (
      <div className="admin-section">
        <PageHeading
          title="Billing & Plans"
          description="Manage your organization's plan, seats, and billing."
        />

        <div className="space-y-8">
          <section>
            <h2>Current Plan</h2>
            <PlanCard billing={billing} />
          </section>

          {billing.plan === 'building' && (
            <section>
              <h2>Seats & Team Size</h2>
              <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                Add or remove seats based on your team size. Minimum 3 seats required.
              </p>
              <SeatsStepper billing={billing} utilization={utilization} />
            </section>
          )}

          <section>
            <h2>Billing Status</h2>
            <div style={{
              padding: '1rem',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-md)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span>Status</span>
                <strong>{billing.status}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Next billing date</span>
                <strong>—</strong>
              </div>
            </div>
          </section>
        </div>

        <style jsx>{`
          .admin-section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .space-y-8 > * + * {
            margin-top: 2rem;
          }

          .text-muted {
            color: var(--color-text-secondary);
          }
        `}</style>
      </div>
    );
  } catch (error) {
    console.error('Error loading billing:', error);
    redirect('/workspace');
  }
}
