import { sources } from '@/mock/api';
export async function POST(req: Request) {
  return sources(req);
}
