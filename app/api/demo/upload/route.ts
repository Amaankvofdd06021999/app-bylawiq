import { upload } from '@/mock/api';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  return upload(req);
}
