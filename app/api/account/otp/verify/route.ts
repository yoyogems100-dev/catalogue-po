import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { customerCookieName, signCustomerToken } from '@/lib/customer-auth';
import { findOrCreateCustomer } from '@/lib/customer-identity';

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();
  const digits = (phone || '').replace(/\D/g, '');
  const trimmedCode = (code || '').trim();

  if (digits.length < 10 || trimmedCode.length !== 6) {
    return NextResponse.json({ error: 'Invalid phone or code' }, { status: 400 });
  }

  const { data: otp } = await supabaseAdmin
    .from('otp_codes')
    .select('id, expires_at')
    .eq('phone', digits)
    .eq('code', trimmedCode)
    .eq('consumed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otp || new Date(otp.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('id', otp.id);

  const identity = await findOrCreateCustomer({ phone: digits });
  await supabaseAdmin
    .from('customers')
    .update({ phone_verified: true, last_login_at: new Date().toISOString() })
    .eq('id', identity.id);

  const token = signCustomerToken(identity.id);

  // Token is always included in the body too -- the web client ignores it (cookie is
  // what it actually uses), the mobile app can't use cookies naturally so it stores
  // this in expo-secure-store and sends it back as Authorization: Bearer <token>.
  const res = NextResponse.json({ ok: true, token, customerId: identity.id });
  res.cookies.set(customerCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
  return res;
}
