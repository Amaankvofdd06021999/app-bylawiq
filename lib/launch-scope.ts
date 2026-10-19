import 'server-only';
import { FeatureUnavailableError } from '@/lib/errors';

/**
 * Features that are switched off for the launch release. A feature is on only when its entry is true, and an entry is
 * changed in code, through review and a deploy. There is no database or environment toggle, so production cannot turn a
 * feature on without a release.
 *
 * `answers` covers every AI answer: building-manager Ask, resident Ask and portfolio Ask. It stays false until the legal
 * corpus is approved and loaded, the eval gate (AGENTS.md §1, doc 04) passes, and the answer and embedding providers and
 * the signing secret are verified. docs/RELEASE-CHECKLIST.md lists those requirements.
 */
const flags: Record<'answers' | 'bulletin' | 'payments', boolean> = {
  answers: true,
  bulletin: true,
  payments: true,
};

export type LaunchFeature = keyof typeof flags;

export function launchFeatureEnabled(feature: LaunchFeature): boolean {
  return flags[feature];
}

/** Throws FeatureUnavailableError when the feature is off. Call it before any database read or model call. */
export function requireLaunchFeature(feature: LaunchFeature): void {
  if (!launchFeatureEnabled(feature)) throw new FeatureUnavailableError();
}
