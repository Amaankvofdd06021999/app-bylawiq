// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { checkSigning } from '@/lib/health';
import { SIGNING_PROBE, signingProbeSignature } from '@/lib/signing-probe';

const SECRET = 'app-secret-value-0123456789abcdef';

describe('checkSigning', () => {
  it('reports not_configured without probing when the app secret is absent', async () => {
    let called = false;
    expect(
      await checkSigning(undefined, async () => {
        called = true;
        return { data: true, error: null };
      }),
    ).toBe('not_configured');
    expect(called).toBe(false);
  });

  it('reports match when the database verifies the app signature', async () => {
    expect(
      await checkSigning(SECRET, async (signature) => ({
        data: signature === signingProbeSignature(SECRET),
        error: null,
      })),
    ).toBe('match');
  });

  it('reports mismatch when the database does not verify it', async () => {
    expect(await checkSigning(SECRET, async () => ({ data: false, error: null }))).toBe('mismatch');
  });

  it('reports unavailable on an error or a thrown probe, never match', async () => {
    expect(await checkSigning(SECRET, async () => ({ data: null, error: { message: 'down' } }))).toBe(
      'unavailable',
    );
    expect(
      await checkSigning(SECRET, async () => {
        throw new Error('network');
      }),
    ).toBe('unavailable');
  });

  it('never sends the secret itself to the probe', async () => {
    let sent = '';
    await checkSigning(SECRET, async (signature) => {
      sent = signature;
      return { data: true, error: null };
    });
    expect(sent).not.toContain(SECRET);
    expect(sent).toHaveLength(64);
    expect(SIGNING_PROBE).toBe('bylawiq-signing-probe-v1');
  });
});
