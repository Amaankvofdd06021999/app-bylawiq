import 'server-only';
import { Resend } from 'resend';
import { stagingAllows } from '@/lib/email/invitations';
import { logger } from '@/lib/logger';

/**
 * Sends one resident notice email. Same rules as invitation email (decision D10): a missing key or sender is a failure, not a
 * silent success; in staging, only allowlisted addresses receive mail. The text never includes building data beyond the
 * notice itself, and a provider error is replaced by a fixed message.
 */

export type NoticeSendResult = { ok: true } | { ok: false; error: string };

export type NoticeSender = (to: string, subject: string, text: string) => Promise<NoticeSendResult>;

export function noticeEmailEnv(env: Record<string, string | undefined> = process.env) {
  return {
    key: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    mode: env.EMAIL_MODE ?? 'live',
    allowlist: env.EMAIL_STAGING_ALLOWLIST,
  };
}

export async function sendNoticeEmail(
  to: string,
  subject: string,
  text: string,
  env: Record<string, string | undefined> = process.env,
): Promise<NoticeSendResult> {
  const config = noticeEmailEnv(env);
  if (!config.key || !config.from)
    return { ok: false, error: 'Email is not configured for this environment.' };
  if (config.mode === 'staging' && !stagingAllows(to, config.allowlist)) {
    return { ok: false, error: 'Staging only sends to approved test addresses.' };
  }
  try {
    const resend = new Resend(config.key);
    const { error } = await resend.emails.send({ from: config.from, to, subject, text });
    if (error) {
      logger.error({ context: 'notice_email', message: 'provider error' });
      return { ok: false, error: 'The email could not be sent.' };
    }
    return { ok: true };
  } catch {
    logger.error({ context: 'notice_email', message: 'send threw' });
    return { ok: false, error: 'The email could not be sent.' };
  }
}
