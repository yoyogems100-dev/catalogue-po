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

// crypto.timingSafeEqual (used for this same comparison in lib/auth.ts and
// lib/customer-auth.ts) needs Node's `crypto` module, which isn't available
// on the Edge runtime middleware runs on -- this is the Web-Crypto-compatible
// equivalent: both inputs are already validated to be 64 lowercase-hex chars,
// so a fixed-length XOR accumulator is a safe constant-time comparison.
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verify(signed: string, secret: string | undefined, kind: 'admin' | 'customer') {
  if (!secret) return false;
  const [value, mac] = signed.split('.');
  if (!value || !/^[a-f0-9]{64}$/.test(mac || '') || signed.split('.').length !== 2) return false;
  if (kind === 'admin' ? value !== 'ok' : !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) return false;
  const expected = await hmac(value, secret);
  return timingSafeEqualHex(expected, mac);
}

async function isAdmin(req: NextRequest) {
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME);
  return cookie ? await verify(cookie.value, sessionSecret('admin'), 'admin') : false;
}

// The web uses a cookie; the mobile app sends the same signed token from
// signCustomerToken() as `Authorization: Bearer <token>` (it has no cookie
// jar), so both have to count as signed in or gating the site logs the app out.
async function isCustomer(req: NextRequest) {
  const secret = sessionSecret('customer');
  const cookie = req.cookies.get(CUSTOMER_COOKIE_NAME);
  if (cookie && (await verify(cookie.value, secret, 'customer'))) return true;

  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) return await verify(authHeader.slice(7).trim(), secret, 'customer');

  return false;
}

// The catalogue is private: a visitor who is not signed in sees the sign-in
// page and nothing else. Only the doors themselves stay open -- the two sign-in
// screens and the endpoints that issue a session. Everything not listed here is
// gated, so a route added later is private by default rather than public by
// omission.
const PUBLIC_PATHS = new Set([
  '/login', // admin sign-in
  '/account/login', // customer sign-in, and the site's front door
  '/api/admin-login',
  '/api/admin-logout',
  '/api/account/otp/request',
  '/api/account/otp/verify',
  '/api/account/email/request',
  '/api/account/email/verify',
  '/api/account/logout',
  '/api/account/me', // the sign-in screen reads its own session state
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json'
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (pathname.startsWith('/admin')) {
    if (await isAdmin(req)) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Admin counts as signed in everywhere else too. Without this, the admin
  // workspace would break the moment it called one of the shared /api/* routes
  // that live outside /api/admin -- an admin holds an admin cookie, not a
  // customer one.
  if ((await isCustomer(req)) || (await isAdmin(req))) return NextResponse.next();

  // An API caller wants an answer, not a login page: a 307 to HTML would show
  // up at the fetch() call site as a confusing parse error.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
  }

  // Send them back where they were headed once they are in, so a shared link
  // to a category still lands on that category after sign-in.
  const url = req.nextUrl.clone();
  url.pathname = '/account/login';
  url.search = '';
  const next = `${pathname}${req.nextUrl.search}`;
  if (next !== '/') url.searchParams.set('next', next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own build output and static files in /public
  // (images, fonts, stylesheets). Those carry no catalogue data on their own
  // and gating them would block the sign-in page's own logo and styles.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpe?g|gif|svg|webp|ico|css|js|mjs|txt|woff2?|ttf|otf|pdf)$).*)']
};
