import { NextRequest, NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'yoyo_admin_session';
const CUSTOMER_COOKIE_NAME = 'yoyo_customer_session';

// Edge Runtime (where middleware runs) doesn't support Node's `crypto` module --
// this uses the Web Crypto API instead, which works in both Edge and Node,
// and produces the same hex HMAC-SHA256 output as the Node version in lib/auth.ts
// and lib/customer-auth.ts.
async function hmac(value: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(value));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verify(signed: string, secret: string) {
  const [value, mac] = signed.split('.');
  if (!value || !mac) return false;
  const expected = await hmac(value, secret);
  return expected === mac;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/account')) {
    if (req.nextUrl.pathname === '/account/login') return NextResponse.next();

    const cookie = req.cookies.get(CUSTOMER_COOKIE_NAME);
    const secret = process.env.CUSTOMER_SESSION_SECRET || 'dev-secret';
    const authed = cookie ? await verify(cookie.value, secret) : false;

    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = '/account/login';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  const secret = process.env.ADMIN_SESSION_SECRET || 'dev-secret';
  const authed = cookie ? await verify(cookie.value, secret) : false;

  if (!authed) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/account/:path*']
};
