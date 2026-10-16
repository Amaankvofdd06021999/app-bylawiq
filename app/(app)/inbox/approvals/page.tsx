import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ReviewInbox } from '@/features/documents/components/review-inbox';

export default async function ApprovalsPage() {
  const user = await requireUser().catch(() => redirect('/login'));
  const db = await createClient();

  // Verify firm owner
  const { data: firmMember } = await db
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .eq('role', 'org_owner')
    .single();

  if (!firmMember) {
    redirect('/');
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Document Review Inbox</h1>
        <p className="subtitle">Approve or request changes on submitted documents</p>
      </div>

      <ReviewInbox />

      <style>{`
        .page-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        .page-header {
          margin-bottom: 2rem;
        }

        .page-header h1 {
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1f2937;
        }

        .subtitle {
          margin: 0;
          color: #666;
          font-size: 0.95rem;
        }
      `}</style>
    </div>
  );
}
