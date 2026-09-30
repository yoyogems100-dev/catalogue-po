import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { findOrCreateCustomer } from '@/lib/customer-identity';
import { passwordProblem } from '@/lib/customer-password';
import { savePassword } from '@/lib/customer-credentials';
import { consumeOtp, signedInResponse } from '@/lib/customer-session';

// Forgot password: the WhatsApp code proves the number, then the new password
// is saved and the customer is signed in. (The code comes from the usual
// /api/account/otp/request.)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const code = String(body.code || '').trim();
  if (phone.length < 10 || code.length !== 6) return NextResponse.json({ error: 'Enter the 6-digit code.' }, { status: 400 });
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem, field: 'password' }, { status: 400 });

  if (!(await consumeOtp(phone, code))) return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });

  const identity = await findOrCreateCustomer({ phone });
  await supabaseAdmin.from('customers').update({ phone_verified: true }).eq('id', identity.id);
  await savePassword(identity.id, body.password, 'customer');
  return signedInResponse(identity.id);
}
