/**
 * Fails the server at boot when production is missing core configuration, so a misconfigured deployment is caught on
 * the first request, with variable names in the error, instead of as a vague failure later.
 *
 * Demo-only runs (DEMO_MODE=on outside Vercel production, as in the CI end-to-end job) skip the check.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NODE_ENV !== 'production') return;
  if (process.env.DEMO_MODE === 'on' && process.env.VERCEL_ENV !== 'production') return;

  const { assertConfig } = await import('./lib/config');
  assertConfig('core');
}
