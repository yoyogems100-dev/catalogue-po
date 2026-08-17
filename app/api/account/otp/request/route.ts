import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/wasarthi';

// The code is always shown on-screen (Phase 3 decision, permanent, not a
// fallback) so login never depends on delivery succeeding. Sending a real
// WhatsApp copy on top of that is best-effort: awaited so logs are useful for
// debugging the integration, but its result never blocks or changes the
// response -- a failed/misconfigured send must not lock anyone out of login.
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

  try {
    await sendWhatsAppTemplate(digits, WHATSAPP_TEMPLATES.otp, [code]);
  } catch (err) {
    console.error('WhatsApp OTP send threw unexpectedly:', err);
  }

  return NextResponse.json({ ok: true, code, needsName: !existingCustomer?.name });
}
