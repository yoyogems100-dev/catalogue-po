import { NextRequest, NextResponse } from 'next/server';
import { sessionSecret } from './lib/session-secret';

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

async function verify(signed: string, secret: string | undefined, kind: 'admin' | 'customer') {
  if (!secret) return false;
  const [value, mac] = signed.split('.');
  if (!value || !/^[a-f0-9]{64}$/.test(mac || '') || signed.split('.').length !== 2) return false;
  if (kind === 'admin' ? value !== 'ok' : !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return false;
  const expected = await hmac(value, secret);
  return expected === mac;
}

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/account')) {
    if (req.nextUrl.pathname === '/account/login') return NextResponse.next();

    const cookie = req.cookies.get(CUSTOMER_COOKIE_NAME);
    const secret = sessionSecret('customer');
    const authed = cookie ? await verify(cookie.value, secret, 'customer') : false;

    if (!authed) {
      const url = req.nextUrl.clone();
      url.pathname = '/account/login';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  const secret = sessionSecret('admin');
  const authed = cookie ? await verify(cookie.value, secret, 'admin') : false;

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
