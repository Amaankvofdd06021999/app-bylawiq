import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getTeamMembers, getPendingInvitations } from '@/features/admin/queries';
import { TeamMembersTable } from '@/features/admin/components/team-members-table';
import { InviteForm } from '@/features/admin/components/invite-form';

export default async function AdminTeamPage() {
  const user = await requireUser();

  try {
    const [members, pendingInvitations] = await Promise.all([
      getTeamMembers(),
      getPendingInvitations(),
    ]);

    return (
      <div className="admin-section">
        <PageHeading
          title="Team Members"
          description="Manage your organization's team, roles, and permissions."
        />

        <div className="space-y-8">
          <InviteForm />
          <section>
            <h2>Active Members ({members.filter((m) => m.status === 'active').length})</h2>
            <TeamMembersTable members={members.filter((m) => m.status === 'active')} />
          </section>
          {pendingInvitations.length > 0 && (
            <section>
              <h2>Pending Invitations ({pendingInvitations.length})</h2>
            </section>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error loading team members:', error);
    redirect('/workspace');
  }
}
