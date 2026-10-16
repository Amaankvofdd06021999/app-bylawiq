// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { checkDatabase } from '@/lib/health';

const URL_ = 'https://project.example.invalid';
const KEY = 'anon-key-placeholder';

function fetchReturning(status: number) {
  return vi.fn(async () => new Response(null, { status })) as unknown as typeof fetch;
}

describe('checkDatabase', () => {
  it('reports not_configured without calling the network when the public env is missing', async () => {
    const fetcher = fetchReturning(200);
    expect(await checkDatabase(undefined, KEY, fetcher)).toBe('not_configured');
    expect(await checkDatabase(URL_, undefined, fetcher)).toBe('not_configured');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('reports ok when the Data API answers below 500', async () => {
    expect(await checkDatabase(URL_, KEY, fetchReturning(401))).toBe('ok');
    expect(await checkDatabase(URL_, KEY, fetchReturning(200))).toBe('ok');
  });

  it('reports unreachable for a 5xx from the Data API, such as the 503 PostgREST returns when Postgres is down', async () => {
    expect(await checkDatabase(URL_, KEY, fetchReturning(503))).toBe('unreachable');
  });

  it('reports unreachable when the request fails or times out', async () => {
    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch;
    expect(await checkDatabase(URL_, KEY, failing)).toBe('unreachable');
  });

  it('calls the anon-keyed rpc endpoint with no-store caching and a timeout', async () => {
    const fetcher = fetchReturning(200);
    await checkDatabase(URL_, KEY, fetcher);
    const [target, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(target).toBe(`${URL_}/rest/v1/rpc/platform_admin_status`);
    expect(init.cache).toBe('no-store');
    expect(init.signal).toBeDefined();
  });
});
