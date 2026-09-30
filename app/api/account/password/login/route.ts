import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkPassword, PASSWORD_MAX } from '@/lib/customer-password';
import { getCredentials } from '@/lib/customer-credentials';
import { recordFailure, signedInResponse, tooManyFailures, visitorHash } from '@/lib/customer-session';

// Phone number + password. One message for every miss (unknown number, no
// password yet, wrong password) so the form can't be used to find out which
// numbers have accounts.
const WRONG = "Wrong number or password. If you haven't set a password yet, use “Forgot password” or sign in with a WhatsApp code.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const password = typeof body.password === 'string' ? body.password : '';
  if (phone.length < 10 || !password || password.length > PASSWORD_MAX) {
    return NextResponse.json({ error: 'Enter your WhatsApp number and password.' }, { status: 400 });
  }

  const ipHash = visitorHash(req);
  if (await tooManyFailures(phone, ipHash)) {
    return NextResponse.json({ error: 'Too many tries. Wait 15 minutes, or sign in with a WhatsApp code.' }, { status: 429 });
  }

  const { data: customer } = await supabaseAdmin.from('customers').select('id, deleted_at').eq('phone', phone).maybeSingle();
  const creds = customer && !customer.deleted_at ? await getCredentials(customer.id) : null;
  if (!customer || !creds || !(await checkPassword(password, creds.password_hash))) {
    await recordFailure(phone, ipHash);
    return NextResponse.json({ error: WRONG }, { status: 401 });
  }
  return signedInResponse(customer.id);
}
