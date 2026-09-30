import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findOrCreateCustomer } from '@/lib/customer-identity';
import { consumeOtp, signedInResponse } from '@/lib/customer-session';

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json();
  const digits = normalizePhone(phone);
  const trimmedCode = (code || '').trim();

  if (digits.length < 10 || trimmedCode.length !== 6) {
    return NextResponse.json({ error: 'Invalid phone or code' }, { status: 400 });
  }
  if (!(await consumeOtp(digits, trimmedCode))) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  const identity = await findOrCreateCustomer({ phone: digits });
  await supabaseAdmin.from('customers').update({ phone_verified: true }).eq('id', identity.id);

  // Token is in the body too -- the web client ignores it (the cookie is what
  // it uses); the mobile app stores it and sends it as Authorization: Bearer.
  return signedInResponse(identity.id);
}
