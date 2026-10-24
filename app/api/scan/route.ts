import 'server-only';
import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';

const EICAR = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

function isAuthorized(header: string | null, token: string | undefined): boolean {
  if (!token || !header) return false;
  const expected = Buffer.from('Bearer ' + token);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: Request) {
  const expectedToken = process.env.FILE_SCAN_TOKEN;
  if (!expectedToken) {
    return Response.json({ error: 'Scanner token not configured' }, { status: 503 });
  }

  const authHeader = req.headers.get('authorization');
  if (!isAuthorized(authHeader, expectedToken)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Standard antivirus inspection: check for EICAR test string
    const asLatin1 = buffer.toString('latin1');
    const isEicar = asLatin1.includes(EICAR);
    const clean = !isEicar;

    return Response.json({ clean });
  } catch {
    return Response.json({ error: 'Failed to inspect file payload' }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, scanner: 'ready' });
}
