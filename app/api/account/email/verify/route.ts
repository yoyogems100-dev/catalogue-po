import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { customerCookieName, signCustomerToken } from '@/lib/customer-auth';
import { findOrCreateCustomer } from '@/lib/customer-identity';

async function verifyToken(token: string) {
  const { data: link } = await supabaseAdmin
    .from('otp_codes')
    .select('id, email, expires_at')
    .eq('code', token)
    .eq('channel', 'email')
    .eq('consumed', false)
    .maybeSingle();

  if (!link || new Date(link.expires_at) < new Date()) return null;

  await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('id', link.id);

  const identity = await findOrCreateCustomer({ email: link.email });
  await supabaseAdmin
    .from('customers')
    .update({ email_verified: true, last_login_at: new Date().toISOString() })
    .eq('id', identity.id);

  return identity;
}

// AJAX path -- used by the header login popover (dev-mode: token was shown on-screen,
// not actually emailed, so there's no real "click the link" step to simulate here).
export async function POST(req: NextRequest) {
  const { token } = await req.json();
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const identity = await verifyToken(token);
  if (!identity) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(customerCookieName(), signCustomerToken(identity.id), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}

// Real magic-link click path -- for when actual email sending is wired up later.
// Always redirects to the homepage per Part 4 (never straight to /account/orders);
// if the customer's name is still missing, /account/orders and the header icon both
// surface the one-time profile prompt on their own, so no special redirect is needed.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const identity = await verifyToken(token);

  const url = req.nextUrl.clone();
  url.pathname = '/';
  url.search = identity ? '' : '?login_error=1';
  const res = NextResponse.redirect(url);

  if (identity) {
    res.cookies.set(customerCookieName(), signCustomerToken(identity.id), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30
    });
  }

  return res;
}
