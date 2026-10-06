import { download } from '@/mock/api';
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return download(req, await params);
}
