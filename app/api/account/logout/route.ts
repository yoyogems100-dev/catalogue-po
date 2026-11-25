import { NextRequest, NextResponse } from 'next/server';
import { actingCookieName, customerCookieName } from '@/lib/customer-auth';
import { safeNext } from '@/lib/safe-next';

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/po/account/login';
  // "Sign out and sign in again" on an order opened in the wrong account sends
  // ?next= so the right buyer lands back on that order after signing in.
  const next = safeNext(req.nextUrl.searchParams.get('next'));
  url.search = '';
  if (next) url.searchParams.set('next', next);
  // 303: the form was a POST; the sign-in screen should load with a GET.
  const res = NextResponse.redirect(url, 303);
  res.cookies.delete(customerCookieName());
  res.cookies.delete(actingCookieName());
  return res;
}
