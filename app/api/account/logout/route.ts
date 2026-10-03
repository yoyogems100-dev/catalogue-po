import { NextRequest, NextResponse } from 'next/server';
import { actingCookieName, customerCookieName } from '@/lib/customer-auth';

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/po/account/login';
  const res = NextResponse.redirect(url);
  res.cookies.delete(customerCookieName());
  res.cookies.delete(actingCookieName());
  return res;
}
