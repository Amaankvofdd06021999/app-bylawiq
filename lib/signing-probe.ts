import 'server-only';
import { createHmac } from 'node:crypto';

/** Fixed, non-secret input. Only its signature under the signing key is compared. */
export const SIGNING_PROBE = 'bylawiq-signing-probe-v1';

/** HMAC-SHA256 of the probe with the app's signing secret, as the database expects it. */
export function signingProbeSignature(secret: string): string {
  return createHmac('sha256', secret).update(SIGNING_PROBE).digest('hex');
}
