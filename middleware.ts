import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'yoyo_admin_session';

// Edge Runtime (where middleware runs) doesn't support Node's `crypto` module --
// this uses the Web Crypto API instead, which works in both Edge and Node,
// and produces the same hex HMAC-SHA256 output as the Node version in lib/auth.ts.
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
  const cookie = req.cookies.get(COOKIE_NAME);
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
  matcher: ['/admin/:path*']
};
