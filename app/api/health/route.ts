import { configured } from '@/lib/env';
import { checkDatabase, checkSigning } from '@/lib/health';
import { probeSigningKey } from '@/lib/health-probe';

/**
 * Readiness. 503 unless the database is reachable and the app's signing key matches the database's. Values are never
 * returned, only states.
 */
export async function GET() {
  const isConfigured = configured();
  const database = await checkDatabase();
  const signing = await checkSigning(process.env.SERVER_SIGNING_SECRET, probeSigningKey);
  const ready = database === 'ok' && signing === 'match';
  return Response.json(
    {
      application: 'bylawiq',
      status: isConfigured ? 'configured' : 'setup_required',
      database,
      signing,
      ready,
    },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
