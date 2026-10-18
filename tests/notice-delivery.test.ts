import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn(), constructed: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
    constructor(key: string) {
      mocks.constructed(key);
    }
  },
}));

import { deliverNotice, maskEmail, NOTICE_SENDING_ENABLED } from '@/features/notices/delivery';
import { sendNoticeEmail } from '@/lib/email/notices';

type Call = { fn: string; args: Record<string, unknown> };

function fakeRpc(responses: Record<string, { data?: unknown; error?: { message: string } | null }>) {
  const calls: Call[] = [];
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return { data: responses[fn]?.data ?? null, error: responses[fn]?.error ?? null };
  };
  return { rpc, calls };
}

const TWO = [{ delivery_id: 'd1' }, { delivery_id: 'd2' }];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sending is off until the sender is approved', () => {
  it('the flag is off', () => {
    expect(NOTICE_SENDING_ENABLED).toBe(false);
  });
});

describe('deliverNotice', () => {
  it('sends by delivery id, and records each outcome for the attempt it sent', async () => {
    const { rpc, calls } = fakeRpc({
      queue_notice_delivery: { data: 2 },
      claim_notice_deliveries: { data: TWO },
    });
    const send = vi.fn().mockResolvedValue({ ok: true });
    await expect(deliverNotice(rpc, 'n1', 'Quiet hours', 'Please observe.', send)).resolves.toEqual({
      queued: 2,
      sent: 2,
      failed: 0,
    });
    expect(send.mock.calls.map((c) => c[0])).toEqual(['d1', 'd2']);
    const recorded = calls.filter((c) => c.fn === 'record_notice_delivery_result').map((c) => c.args);
    expect(recorded).toEqual([
      { p_delivery: 'd1', p_ok: true, p_error: null },
      { p_delivery: 'd2', p_ok: true, p_error: null },
    ]);
  });

  it('never passes an address to the sender or the record: only delivery ids move through this path', async () => {
    const { rpc, calls } = fakeRpc({
      queue_notice_delivery: { data: 1 },
      claim_notice_deliveries: { data: TWO.slice(0, 1) },
    });
    const send = vi.fn().mockResolvedValue({ ok: true });
    await deliverNotice(rpc, 'n1', 's', 'b', send);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/@/);
    expect(JSON.stringify(calls)).not.toMatch(/@/);
  });

  it('a partial failure records the failed attempt and keeps going for the others', async () => {
    const { rpc, calls } = fakeRpc({
      queue_notice_delivery: { data: 2 },
      claim_notice_deliveries: { data: TWO },
    });
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'The email could not be sent.' })
      .mockResolvedValueOnce({ ok: true });
    await expect(deliverNotice(rpc, 'n1', 's', 'b', send)).resolves.toEqual({
      queued: 2,
      sent: 1,
      failed: 1,
    });
    const failed = calls.find((c) => c.fn === 'record_notice_delivery_result' && c.args.p_delivery === 'd1');
    expect(failed?.args).toEqual({ p_delivery: 'd1', p_ok: false, p_error: 'The email could not be sent.' });
  });

  it('a retry claims failed deliveries again and queues nobody new', async () => {
    const { rpc } = fakeRpc({
      queue_notice_delivery: { data: 0 },
      claim_notice_deliveries: { data: [TWO[0]] },
    });
    const send = vi.fn().mockResolvedValue({ ok: true });
    await expect(deliverNotice(rpc, 'n1', 's', 'b', send)).resolves.toEqual({
      queued: 0,
      sent: 1,
      failed: 0,
    });
  });

  it('sends nothing when no delivery is due', async () => {
    const { rpc } = fakeRpc({ queue_notice_delivery: { data: 0 }, claim_notice_deliveries: { data: [] } });
    const send = vi.fn();
    await expect(deliverNotice(rpc, 'n1', 's', 'b', send)).resolves.toEqual({
      queued: 0,
      sent: 0,
      failed: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it('refuses a notice that is not approved, with a plain message', async () => {
    const { rpc } = fakeRpc({ queue_notice_delivery: { error: { message: 'notice_not_approved' } } });
    await expect(deliverNotice(rpc, 'n1', 's', 'b', vi.fn())).rejects.toMatchObject({
      message: 'Only an approved notice can be sent to residents.',
    });
  });

  it('refuses when the caller is not allowed, and sends nothing', async () => {
    const { rpc } = fakeRpc({ queue_notice_delivery: { error: { message: 'forbidden' } } });
    const send = vi.fn();
    await expect(deliverNotice(rpc, 'n1', 's', 'b', send)).rejects.toBeInstanceOf(Error);
    expect(send).not.toHaveBeenCalled();
  });

  it('a failure to record an outcome stops the run with an error, not a silent success', async () => {
    const { rpc } = fakeRpc({
      queue_notice_delivery: { data: 1 },
      claim_notice_deliveries: { data: [TWO[0]] },
      record_notice_delivery_result: { error: { message: 'connection reset by peer' } },
    });
    const send = vi.fn().mockResolvedValue({ ok: true });
    await expect(deliverNotice(rpc, 'n1', 's', 'b', send)).rejects.toBeInstanceOf(Error);
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('alice@example.org')).toBe('a***@example.org');
  });

  it('hides an address with no usable local part', () => {
    expect(maskEmail('@example.org')).toBe('***');
    expect(maskEmail('not-an-address')).toBe('***');
  });
});

describe('sendNoticeEmail (the provider wrapper, used only by the future sender)', () => {
  it('reports a missing key or sender as a failure, without calling the provider', async () => {
    await expect(sendNoticeEmail('a@example.org', 's', 'b', {})).resolves.toEqual({
      ok: false,
      error: 'Email is not configured for this environment.',
    });
    expect(mocks.constructed).not.toHaveBeenCalled();
  });

  it('in staging, refuses a non-allowlisted address without calling the provider', async () => {
    const env = {
      RESEND_API_KEY: 'k',
      EMAIL_FROM: 'a@b.c',
      EMAIL_MODE: 'staging',
      EMAIL_STAGING_ALLOWLIST: 'x@y.z',
    };
    await expect(sendNoticeEmail('a@example.org', 's', 'b', env)).resolves.toEqual({
      ok: false,
      error: 'Staging only sends to approved test addresses.',
    });
    expect(mocks.constructed).not.toHaveBeenCalled();
  });

  it('turns a provider error into a fixed message, not the provider text', async () => {
    mocks.send.mockResolvedValue({ error: { message: 'rate limit: 429 for key re_abc' } });
    const env = { RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.c' };
    await expect(sendNoticeEmail('a@example.org', 's', 'b', env)).resolves.toEqual({
      ok: false,
      error: 'The email could not be sent.',
    });
  });

  it('treats a thrown provider error as a failure', async () => {
    mocks.send.mockRejectedValue(new Error('socket hang up'));
    const env = { RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.c' };
    await expect(sendNoticeEmail('a@example.org', 's', 'b', env)).resolves.toEqual({
      ok: false,
      error: 'The email could not be sent.',
    });
  });
});
