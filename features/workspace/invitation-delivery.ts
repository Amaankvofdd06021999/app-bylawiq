import 'server-only';
import type { SessionUser } from '@/lib/auth/guards';
import { sendInvitationEmail, type InvitationEmailStatus } from '@/lib/email/invitations';
import { logger } from '@/lib/logger';

// Sends an invitation email and records what happened on the invitation (decision D10). The link is returned to the
// caller in every case, so an email that was not sent never leaves the invitation unusable.
export async function deliverInvitation(
  db: SessionUser['client'],
  input: { invitationId: string; buildingId: string; email: string; role: string; link: string },
): Promise<InvitationEmailStatus> {
  const { data: building } = await db
    .from('buildings')
    .select('name')
    .eq('id', input.buildingId)
    .maybeSingle();
  const result = await sendInvitationEmail({
    to: input.email,
    buildingName: building?.name ?? 'your building',
    role: input.role,
    link: input.link,
  });
  const { error } = await db.rpc('record_invitation_email', {
    p_invitation: input.invitationId,
    p_status: result.status,
    p_error: result.error ?? null,
  });
  if (error) logger.error({ context: 'record_invitation_email', error: error.message });
  return result.status;
}
