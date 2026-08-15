import { NextRequest, NextResponse } from 'next/server';
import { adminCookieName, signAdminToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminCookieName(), signAdminToken(), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 14 // 2 weeks
  });
  return res;
}
