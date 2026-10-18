import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { FeatureUnavailableError } from '@/lib/errors';
import { launchFeatureEnabled, requireLaunchFeature } from '@/lib/launch-scope';

describe('launch scope: bulletin and payments are off for this release', () => {
  it('the bulletin and payments features are off in code', () => {
    expect(launchFeatureEnabled('bulletin')).toBe(false);
    expect(launchFeatureEnabled('payments')).toBe(false);
  });
});

describe('launch scope: AI answers are off for this release', () => {
  it('the answers feature is off in code', () => {
    expect(launchFeatureEnabled('answers')).toBe(false);
  });

  it('requireLaunchFeature refuses with a 403 feature_unavailable error', () => {
    expect(() => requireLaunchFeature('answers')).toThrow(FeatureUnavailableError);
    try {
      requireLaunchFeature('answers');
    } catch (e) {
      expect(e).toBeInstanceOf(FeatureUnavailableError);
      expect((e as FeatureUnavailableError).status).toBe(403);
      expect((e as FeatureUnavailableError).code).toBe('feature_unavailable');
    }
  });
});
