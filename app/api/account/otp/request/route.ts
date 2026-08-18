import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/wasarthi';

// Real WhatsApp delivery is confirmed working (Phase 4), so the on-screen/
// prefilled code fallback is now conditional, not permanent: it's only
// returned when the real send didn't happen or didn't succeed, so login
// never fully locks out on a delivery outage. When WhatsApp delivery
// succeeds, the customer must actually read the code from WhatsApp --
// that's the point of requiring verification at all.
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

  let delivered = false;
  try {
    const result = await sendWhatsAppTemplate(digits, WHATSAPP_TEMPLATES.otp, [code]);
    delivered = result.ok && !result.stubbed;
  } catch (err) {
    console.error('WhatsApp OTP send threw unexpectedly:', err);
  }

  return NextResponse.json({
    ok: true,
    code: delivered ? undefined : code,
    needsName: !existingCustomer?.name
  });
}
