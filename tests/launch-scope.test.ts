import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { launchFeatureEnabled, requireLaunchFeature } from '@/lib/launch-scope';

describe('launch scope: bulletin, payments, and answers are enabled', () => {
  it('the bulletin and payments features are on in code', () => {
    expect(launchFeatureEnabled('bulletin')).toBe(true);
    expect(launchFeatureEnabled('payments')).toBe(true);
  });

  it('the answers feature is on in code', () => {
    expect(launchFeatureEnabled('answers')).toBe(true);
  });

  it('requireLaunchFeature succeeds without throwing', () => {
    expect(() => requireLaunchFeature('answers')).not.toThrow();
  });
});
