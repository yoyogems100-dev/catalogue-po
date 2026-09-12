import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/wasarthi';
import { randomInt } from 'node:crypto';
import { allowDevAuthCodes } from '@/lib/dev-auth';

// Delivery outages must not turn off verification. Only explicit local testing may expose a code.
export async function POST(req: NextRequest) {
  const { phone } = await req.json();

  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) {
    return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
  }

  const code = randomInt(100000, 1000000).toString();
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

  if (!delivered && !allowDevAuthCodes()) {
    await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('phone', digits).eq('code', code);
    return NextResponse.json({ error: 'We could not deliver your WhatsApp code. Please try again shortly.' }, { status: 503 });
  }
  return NextResponse.json({
    ok: true,
    code: !delivered && allowDevAuthCodes() ? code : undefined,
    needsName: !existingCustomer?.name
  });
}
