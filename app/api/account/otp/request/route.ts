import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// OTP delivery is on-screen only, by design (not a stopgap) -- see
// app/account/login/page.tsx. There's no WhatsApp/SMS channel to pick since
// neither actually sends anything; lib/wasarthi.ts is kept dormant in case
// real WhatsApp Business API sending is wired up later, but this route
// doesn't call it.
export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  // Rate-limit: only one active (unconsumed) code per phone at a time.
  await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('phone', digits).eq('consumed', false);

  const { error } = await supabaseAdmin.from('otp_codes').insert({
    phone: digits,
    code,
    channel: 'whatsapp',
    expires_at: expiresAt,
    consumed: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data: existingCustomer } = await supabaseAdmin.from('customers').select('name').eq('phone', digits).maybeSingle();

  return NextResponse.json({ ok: true, code, needsName: !existingCustomer?.name });
}
