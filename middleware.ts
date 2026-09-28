import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'pitchaton_session';

/**
 * Edge middleware — a fast first line of defence.
 *
 * It only checks that a session cookie *exists* for private routes; the
 * authoritative check (signature verification + role lookup in the database)
 * happens in `lib/guards.ts` on the server for every protected page. Keeping
 * the crypto out of the edge keeps the app working identically on any host.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const isPrivate = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');
  if (!isPrivate) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) {
    const response = NextResponse.next();
    // Never let a proxy or the browser cache a personalised page.
    response.headers.set('Cache-Control', 'private, no-store, max-age=0');
    response.headers.set('X-Robots-Tag', 'noindex');
    return response;
  }

  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*'],
};
