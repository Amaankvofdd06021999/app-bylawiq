import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
export async function proxy(request: NextRequest) {
  // The interactive demo is a hard 404 unless DEMO_MODE=on. The layout and route handlers gate too, but a page under
  // the root loading boundary streams, so only here can the response carry a real 404 status and no demo markup.
  const path = request.nextUrl.pathname;
  if (
    process.env.DEMO_MODE !== 'on' &&
    (path === '/demo' || path.startsWith('/demo/') || path === '/api/demo' || path.startsWith('/api/demo/'))
  )
    return new NextResponse(null, { status: 404 });
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|fonts|images|favicon.ico|api/inngest).*)'] };
