// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { assertFileClean } from '@/lib/security/file-scan';
import { assertTextLayer } from '@/lib/ai/text-layer';

const BYTES = new TextEncoder().encode('some bylaw text');
const CONFIG = { url: 'http://127.0.0.1:8790/scan', token: 'token-0123456789abcdef' };

function fetchWith(response: Response | Error) {
  return vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  }) as unknown as typeof fetch;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'resolved';
  } catch (e) {
    return (e as { code?: string }).code ?? 'unknown';
  }
}

describe('assertFileClean: fails closed', () => {
  it('refuses without calling anything when the scanner is not configured', async () => {
    const fetcher = fetchWith(json({ clean: true }));
    expect(await codeOf(assertFileClean(BYTES, {}, fetcher))).toBe('scanner_unavailable');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('treats a network failure as unavailable, not clean', async () => {
    expect(await codeOf(assertFileClean(BYTES, CONFIG, fetchWith(new TypeError('fetch failed'))))).toBe(
      'scanner_unavailable',
    );
  });

  it('treats a non-OK response as unavailable, even if its body says clean', async () => {
    expect(await codeOf(assertFileClean(BYTES, CONFIG, fetchWith(json({ clean: true }, 500))))).toBe(
      'scanner_unavailable',
    );
  });

  it('treats an unreadable verdict as unavailable', async () => {
    expect(
      await codeOf(assertFileClean(BYTES, CONFIG, fetchWith(new Response('not json', { status: 200 })))),
    ).toBe('scanner_unavailable');
    expect(await codeOf(assertFileClean(BYTES, CONFIG, fetchWith(json({ verdict: 'ok' }))))).toBe(
      'scanner_unavailable',
    );
  });

  it('rejects a file the scanner marks not clean', async () => {
    expect(await codeOf(assertFileClean(BYTES, CONFIG, fetchWith(json({ clean: false }))))).toBe(
      'scan_failed',
    );
  });

  it('passes only a clean verdict, sent with the bearer token to the configured URL', async () => {
    const fetcher = fetchWith(json({ clean: true }));
    expect(await codeOf(assertFileClean(BYTES, CONFIG, fetcher))).toBe('resolved');
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(CONFIG.url);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ' + CONFIG.token);
  });
});

describe('assertTextLayer: scanned PDFs are refused clearly', () => {
  it('refuses a PDF with no text layer, as ocr_required, with a message that says what to upload instead', async () => {
    let error: { code?: string; message?: string } = {};
    try {
      assertTextLayer('   ');
    } catch (e) {
      error = e as typeof error;
    }
    expect(error.code).toBe('ocr_required');
    expect(error.message).toMatch(/scanned/i);
    expect(error.message).toMatch(/searchable PDF/);
  });

  it('accepts a PDF with a usable text layer', () => {
    expect(() => assertTextLayer('Pets are limited to two per unit. '.repeat(5))).not.toThrow();
  });
});
