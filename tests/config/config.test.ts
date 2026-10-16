import { describe, expect, it } from 'vitest';
import { assertConfig, CONFIG_GROUPS, isGroupConfigured, missingConfig } from '@/lib/config';

const SECRET_VALUE = 'sk-this-value-must-never-appear-in-errors';

describe('missingConfig', () => {
  it('lists the variable names that are absent or blank, and nothing else', () => {
    const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://x.invalid', SUPABASE_SERVICE_ROLE_KEY: '   ' };
    expect(missingConfig('core', env)).toEqual(
      expect.arrayContaining([
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SERVER_SIGNING_SECRET',
      ]),
    );
    expect(missingConfig('core', env)).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('reports a group as configured only when every variable is present', () => {
    const env = Object.fromEntries(CONFIG_GROUPS.email.map((name) => [name, 'set']));
    expect(isGroupConfigured('email', env)).toBe(true);
    expect(isGroupConfigured('email', { RESEND_API_KEY: 'set' })).toBe(false);
  });
});

describe('assertConfig', () => {
  it('throws a config_error that names the missing variables and never echoes a value', () => {
    const env = { RESEND_API_KEY: SECRET_VALUE };
    let caught: unknown;
    try {
      assertConfig('email', env);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    const message = (caught as Error).message;
    expect(message).toContain('EMAIL_FROM');
    expect(message).not.toContain(SECRET_VALUE);
    expect((caught as { code?: string }).code).toBe('config_error');
  });

  it('passes silently when the group is complete', () => {
    const env = Object.fromEntries(CONFIG_GROUPS.fileScan.map((name) => [name, 'set']));
    expect(() => assertConfig('fileScan', env)).not.toThrow();
  });
});
