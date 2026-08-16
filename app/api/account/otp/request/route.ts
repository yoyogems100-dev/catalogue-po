import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/wasarthi';

export async function POST(req: NextRequest) {
  const { phone, channel } = await req.json();

  if (channel !== 'whatsapp' && channel !== 'sms') {
    return NextResponse.json({ error: 'Invalid channel' }, { status: 400 });
  }

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
    channel,
    expires_at: expiresAt,
    consumed: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // WORKAROUND: devCode lets the login flow be tested without a working delivery
  // channel. It's only ever set when the code was NOT actually sent -- for WhatsApp
  // that's automatic (sendWhatsAppTemplate returns stubbed:true until
  // WHATSAPP_OTP_ENABLED=true, at which point this branch stops firing and devCode
  // stays null with no code change needed here). For SMS it's always set, since
  // there's no provider wired yet -- that part only goes away once one is chosen
  // (see TODO below), which is a separate, unrelated piece of work.
  let devCode: string | null = null;

  if (channel === 'whatsapp') {
    const result = await sendWhatsAppTemplate(digits, WHATSAPP_TEMPLATES.otp, [code]);
    if (result.stubbed) devCode = code;
  } else {
    // TODO: wire to SMS provider once chosen (e.g. MSG91, Twilio).
    console.log(`[SMS stub] would send OTP ${code} to ${digits}`);
    devCode = code;
  }

  return NextResponse.json({ ok: true, devCode });
}
