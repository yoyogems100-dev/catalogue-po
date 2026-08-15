import { NextRequest, NextResponse } from 'next/server';
import { customerCookieName } from '@/lib/customer-auth';

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/account/login';
  const res = NextResponse.redirect(url);
  res.cookies.delete(customerCookieName());
  return res;
}
