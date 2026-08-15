import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  const res = NextResponse.redirect(url);
  res.cookies.delete(adminCookieName());
  return res;
}
