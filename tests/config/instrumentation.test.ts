// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { register } from '@/instrumentation';

const KEYS = ['NODE_ENV', 'NEXT_RUNTIME', 'DEMO_MODE', 'VERCEL_ENV', 'NEXT_PUBLIC_SUPABASE_URL'] as const;
function setEnv(key: string, value: string) {
  (process.env as Record<string, string | undefined>)[key] = value;
}

const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const key of KEYS) saved[key] = process.env[key];
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_RUNTIME = 'nodejs';
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else setEnv(key, saved[key] as string);
  }
});

describe('instrumentation register', () => {
  it('fails production startup when core configuration is missing, naming the variables only', async () => {
    setEnv('NODE_ENV', 'production');
    await expect(register()).rejects.toThrow(/Missing configuration for core: .*NEXT_PUBLIC_SUPABASE_URL/);
  });

  it('skips the check for demo-only runs outside Vercel production', async () => {
    setEnv('NODE_ENV', 'production');
    process.env.DEMO_MODE = 'on';
    await expect(register()).resolves.toBeUndefined();
  });

  it('does not run the check in development', async () => {
    setEnv('NODE_ENV', 'development');
    await expect(register()).resolves.toBeUndefined();
  });
});
