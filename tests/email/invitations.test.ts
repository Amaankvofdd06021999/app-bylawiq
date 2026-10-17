import { describe, it, expect, beforeEach, vi } from 'vitest';

// Decision D10. Resend is replaced by a mock, so no email leaves the test run.
const send = vi.fn();
vi.mock('server-only', () => ({}));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { sendInvitationEmail, stagingAllows, invitationEmailText } from '@/lib/email/invitations';

const invite = {
  to: 'person@example.com',
  buildingName: 'Oak Court',
  role: 'owner_resident',
  link: 'https://app.example/invite/abc',
};

describe('invitation email (D10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_MODE;
    delete process.env.EMAIL_STAGING_ALLOWLIST;
  });

  it('reports not_configured when no key or sender is set, and never calls the provider', async () => {
    expect(await sendInvitationEmail(invite)).toEqual({ status: 'not_configured' });
    process.env.RESEND_API_KEY = 'test-key';
    expect(await sendInvitationEmail(invite)).toEqual({ status: 'not_configured' });
    expect(send).not.toHaveBeenCalled();
  });

  it('in staging, sends only to test recipients and reports skipped_staging for everyone else', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'BylawIQ <noreply@example.com>';
    process.env.EMAIL_MODE = 'staging';
    process.env.EMAIL_STAGING_ALLOWLIST = 'tester@example.com';
    expect(await sendInvitationEmail(invite)).toEqual({ status: 'skipped_staging' });
    expect(send).not.toHaveBeenCalled();
  });

  it('sends in live mode and reports sent when the provider accepts the message', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'BylawIQ <noreply@example.com>';
    send.mockResolvedValue({ error: null });
    expect(await sendInvitationEmail(invite)).toEqual({ status: 'sent' });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: invite.to,
        from: 'BylawIQ <noreply@example.com>',
        text: expect.stringContaining(invite.link),
      }),
    );
  });

  it('reports failed with a fixed message, not the provider text', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'BylawIQ <noreply@example.com>';
    send.mockResolvedValue({ error: { message: 'raw provider detail that must not reach the user' } });
    const r = await sendInvitationEmail(invite);
    expect(r.status).toBe('failed');
    expect(r.error).not.toContain('raw provider detail');
  });

  it('treats a thrown provider error as failed', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'BylawIQ <noreply@example.com>';
    send.mockRejectedValue(new Error('network down'));
    expect((await sendInvitationEmail(invite)).status).toBe('failed');
  });
});

describe('staging allowlist and message text', () => {
  it('allows the provider test domain and listed addresses only, case-insensitively', () => {
    expect(stagingAllows('delivered@resend.dev', undefined)).toBe(true);
    expect(stagingAllows('Tester@Example.com', 'tester@example.com, other@example.com')).toBe(true);
    expect(stagingAllows('person@example.com', 'tester@example.com')).toBe(false);
    expect(stagingAllows('person@example.com', '')).toBe(false);
  });

  it('includes the building, the role in words, the link and the legal-information line', () => {
    const text = invitationEmailText(invite);
    expect(text).toContain('Oak Court');
    expect(text).toContain('owner resident');
    expect(text).toContain(invite.link);
    expect(text).toContain('legal information, not legal advice');
  });
});
