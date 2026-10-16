import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getTeamMembers, getPendingInvitations } from '@/features/admin/queries';
import { TeamMembersTable } from '@/features/admin/components/team-members-table';
import { PendingInvitationsTable } from '@/features/admin/components/pending-invitations-table';
import { InviteForm } from '@/features/admin/components/invite-form';

export default async function AdminTeamPage() {
  await requireUser();

  // Only the data load is guarded: rendering happens outside try, so errors in the JSX are not swallowed here.
  let members: Awaited<ReturnType<typeof getTeamMembers>>;
  let pendingInvitations: Awaited<ReturnType<typeof getPendingInvitations>>;
  try {
    [members, pendingInvitations] = await Promise.all([getTeamMembers(), getPendingInvitations()]);
  } catch (error) {
    console.error('Error loading team members:', error);
    redirect('/workspace');
  }

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
            <PendingInvitationsTable invitations={pendingInvitations} />
          </section>
        )}
      </div>

      <style>{`
          .admin-section {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
          }

          .space-y-8 > * + * {
            margin-top: 2rem;
          }
        `}</style>
    </div>
  );
}
