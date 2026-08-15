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

  if (channel === 'whatsapp') {
    await sendWhatsAppTemplate(digits, WHATSAPP_TEMPLATES.otp, [code]);
  } else {
    // TODO: wire to SMS provider once chosen (e.g. MSG91, Twilio).
    console.log(`[SMS stub] would send OTP ${code} to ${digits}`);
  }

  return NextResponse.json({ ok: true });
}
