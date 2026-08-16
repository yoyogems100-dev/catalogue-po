import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { customerCookieName, signCustomerToken } from '@/lib/customer-auth';

export async function POST(req: NextRequest) {
  const { phone, code, name } = await req.json();
  const digits = (phone || '').replace(/\D/g, '');
  const trimmedCode = (code || '').trim();
  const trimmedName = (name || '').trim();

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

  const { data: existing } = await supabaseAdmin.from('customers').select('id, name').eq('phone', digits).maybeSingle();

  let customerId: number;
  if (existing) {
    customerId = existing.id;
    const patch: Record<string, any> = { phone_verified: true, last_login_at: new Date().toISOString() };
    if (trimmedName && !existing.name) patch.name = trimmedName;
    await supabaseAdmin.from('customers').update(patch).eq('id', customerId);
  } else {
    const { data: created, error } = await supabaseAdmin
      .from('customers')
      .insert({ phone: digits, name: trimmedName || null, phone_verified: true, last_login_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Failed to create customer' }, { status: 400 });
    }
    customerId = created.id;
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(customerCookieName(), signCustomerToken(customerId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });
  return res;
}
