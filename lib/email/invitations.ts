import 'server-only';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

// Decision D10: transactional email through Resend. A missing key or sender is reported, not hidden: the caller always
// shows the invitation link, so an unsent email never leaves an invitation that nobody can use.
//
// EMAIL_MODE:
//   live (default): send to any recipient.
//   staging: send only to EMAIL_STAGING_ALLOWLIST (comma-separated addresses) and to Resend's test domain (resend.dev).

export type InvitationEmailStatus = 'sent' | 'failed' | 'not_configured' | 'skipped_staging';

export type InvitationEmailResult = { status: InvitationEmailStatus; error?: string };

export function stagingAllows(address: string, allowlist: string | undefined): boolean {
  const normalised = address.trim().toLowerCase();
  if (normalised.endsWith('@resend.dev')) return true;
  return (allowlist ?? '')
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalised);
}

export function invitationEmailText(input: { buildingName: string; role: string; link: string }): string {
  return [
    `You have been invited to ${input.buildingName} on BylawIQ as ${input.role.replace(/_/g, ' ')}.`,
    '',
    'Open this private link to accept. It works once you sign in with this email address:',
    input.link,
    '',
    'If you did not expect this invitation, you can ignore this message.',
    '',
    'BylawIQ gives legal information, not legal advice.',
  ].join('\n');
}

export async function sendInvitationEmail(input: {
  to: string;
  buildingName: string;
  role: string;
  link: string;
}): Promise<InvitationEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { status: 'not_configured' };

  if (
    (process.env.EMAIL_MODE ?? 'live') === 'staging' &&
    !stagingAllows(input.to, process.env.EMAIL_STAGING_ALLOWLIST)
  ) {
    return { status: 'skipped_staging' };
  }

  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from,
      to: input.to,
      subject: `Invitation to ${input.buildingName} on BylawIQ`,
      text: invitationEmailText(input),
    });
    if (error) {
      logger.error({ context: 'send_invitation_email', error: error.message });
      return { status: 'failed', error: 'The email provider did not accept the message.' };
    }
    return { status: 'sent' };
  } catch (e) {
    logger.error({ context: 'send_invitation_email', error: e instanceof Error ? e.message : 'unknown' });
    return { status: 'failed', error: 'The email could not be sent.' };
  }
}
