import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { allowDevAuthCodes } from '@/lib/dev-auth';

// Email delivery is not configured. Direct links are restricted to explicit local testing.
export async function POST(req: NextRequest) {
  if (!allowDevAuthCodes()) return NextResponse.json({ error: 'Email sign-in is not available yet. Please use WhatsApp sign-in.' }, { status: 503 });
  const { email } = await req.json();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanEmail || !cleanEmail.includes('@')) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Rate-limit: only one active (unconsumed) link per email at a time.
  await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('email', cleanEmail).eq('consumed', false);

  const { error } = await supabaseAdmin.from('otp_codes').insert({
    email: cleanEmail,
    code: token,
    channel: 'email',
    expires_at: expiresAt,
    consumed: false
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const link = `${req.nextUrl.origin}/api/account/email/verify?token=${token}`;
  const { data: existingCustomer } = await supabaseAdmin.from('customers').select('name').eq('email', cleanEmail).maybeSingle();

  return NextResponse.json({ ok: true, link, token, needsName: !existingCustomer?.name });
}
