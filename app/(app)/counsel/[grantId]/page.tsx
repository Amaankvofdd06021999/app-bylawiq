import { PageHeading } from '@/components/ui';
import { requireUser } from '@/lib/auth/guards';
import { getCounselPacket } from '@/features/counsel/queries';
import { CounselCommentForm } from '@/features/counsel/components/counsel-panels';

export const dynamic = 'force-dynamic';

export default async function CounselPacketPage({ params }: { params: Promise<{ grantId: string }> }) {
  const { grantId } = await params;
  const user = await requireUser();
  const packet = await getCounselPacket(user, grantId);

  // One neutral state for every case where the packet is not visible: expired, ended, someone else's, or missing.
  if (!packet) {
    return (
      <main className="workspace-page">
        <PageHeading title="Review packet" description="This review is not available." />
        <p role="status">
          This review is not available. It may have expired, been ended by the building manager, or never been
          shared with you.
        </p>
      </main>
    );
  }

  const v = packet.version;
  return (
    <main className="workspace-page">
      <PageHeading
        title={`${packet.sectionRef} ${packet.title}`.trim()}
        description={`Review packet, version ${v.version}. Access ends ${new Date(packet.expiresAt).toLocaleDateString()}.`}
      />
      <p className="muted">
        You can read this amendment and comment on it. You cannot edit, approve, adopt or file it. Legal
        information, not legal advice.
      </p>
      <section aria-labelledby="packet-text">
        <h2 id="packet-text">Proposed text</h2>
        <p className="bylaw-current">{v.body}</p>
        <h3>Reason for change</h3>
        <p>{v.rationale || 'None given.'}</p>
        <p className="muted">Status: {v.status.replace(/_/g, ' ')}</p>
      </section>
      <section aria-labelledby="packet-comments">
        <h2 id="packet-comments">Comments</h2>
        {packet.comments.length === 0 ? (
          <p className="muted">No comments yet.</p>
        ) : (
          <ol className="comment-list">
            {packet.comments.map((c) => (
              <li key={c.id}>
                <p>{c.body}</p>
                <small>
                  {c.user_id === packet.viewerId ? 'You' : 'Building team'} ·{' '}
                  {new Date(c.created_at).toLocaleString()}
                </small>
              </li>
            ))}
          </ol>
        )}
        <CounselCommentForm grantId={packet.grantId} />
      </section>
    </main>
  );
}
