import { z } from 'zod';
import { ForbiddenError } from '@/lib/errors';
import { newId, type MockState } from '../store';
import { isPlatformAdmin } from '../rules';
import { now, run, type Result } from './shared';
// Platform feature flags (demo only — there is no flags table yet). Only the platform admin may change one, and
// every change is written to the platform audit. Turning resident AI off hides Ask from residents at once
// (mock/rules.ts#canResidentAsk).
// TODO(legal): resident AI needs legal sign-off before it can be turned on outside the demo.
const flagInput = z.object({ flag: z.literal('residentAi'), enabled: z.boolean() });
export function setFlag(s: MockState, userId: string, raw: unknown): Result<object> {
  return run(() => {
    const { flag, enabled } = flagInput.parse(raw);
    if (!isPlatformAdmin(s, userId)) throw new ForbiddenError();
    s.platform.flags[flag] = enabled;
    s.platform.audit.push({
      id: newId(),
      actor_id: userId,
      action: 'flag.update',
      target_id: null,
      summary: `Resident AI turned ${enabled ? 'on' : 'off'}`,
      occurred_at: now(),
    });
    return {};
  });
}
