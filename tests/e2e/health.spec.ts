import { expect, test } from '@playwright/test';

/** The health endpoint reports database reachability. Its expected value depends on whether the local stack is wired in. */
test('health reports the database as ok when the local stack is configured, and not_configured otherwise', async ({
  request,
}) => {
  const res = await request.get('/api/health');
  const body = (await res.json()) as {
    application: string;
    status: string;
    database: string;
    signing?: string;
    ready?: boolean;
  };
  expect(body.application).toBe('bylawiq');
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    expect(res.status()).toBe(200);
    expect(body.database).toBe('ok');
    expect(body.signing).toBe('match');
    expect(body.ready).toBe(true);
  } else {
    expect(body.database).toBe('not_configured');
    expect(body.status).toBe('setup_required');
  }
});
