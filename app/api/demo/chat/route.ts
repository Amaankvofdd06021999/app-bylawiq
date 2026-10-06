import { chat } from '@/mock/api';
export const runtime = 'nodejs';
export const maxDuration = 300;
export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  return chat(req);
}
