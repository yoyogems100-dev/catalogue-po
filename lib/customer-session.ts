import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { customerCookieName, signCustomerToken } from '@/lib/customer-auth';

// Signed in customers stay signed in on that device for 180 days, whichever
// way they signed in (password, WhatsApp code or a password reset).
export const CUSTOMER_SESSION_DAYS = 180;

/** The response every successful sign-in returns: session cookie for the web,
 *  the same token in the body for the mobile app (it has no cookie jar). */
export async function signedInResponse(customerId: number, extra: Record<string, unknown> = {}) {
  await supabaseAdmin.from('customers').update({ last_login_at: new Date().toISOString() }).eq('id', customerId);
  const token = signCustomerToken(customerId);
  const res = NextResponse.json({ ok: true, token, customerId, ...extra });
  res.cookies.set(customerCookieName(), token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * CUSTOMER_SESSION_DAYS
  });
  return res;
}

/** Uses up a WhatsApp code if it's valid for this number. */
export async function consumeOtp(phone: string, code: string): Promise<boolean> {
  const { data: otp } = await supabaseAdmin
    .from('otp_codes')
    .select('id, expires_at')
    .eq('phone', phone)
    .eq('code', code)
    .eq('consumed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!otp || new Date(otp.expires_at) < new Date()) return false;
  await supabaseAdmin.from('otp_codes').update({ consumed: true }).eq('id', otp.id);
  return true;
}

// Wrong passwords: at most 8 per number and 30 per visitor in 15 minutes.
const WINDOW_MINUTES = 15;
const PER_PHONE = 8;
const PER_VISITOR = 30;

export function visitorHash(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  // Salted so the stored value can't be turned back into an address.
  return createHash('sha256').update(`${process.env.ADMIN_SESSION_SECRET || 'yoyo'}:login:${ip}`).digest('hex').slice(0, 32);
}

export async function tooManyFailures(phone: string, ipHash: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const [byPhone, byVisitor] = await Promise.all([
    supabaseAdmin.from('customer_login_failures').select('id', { count: 'exact', head: true }).eq('phone', phone).gte('created_at', since),
    supabaseAdmin.from('customer_login_failures').select('id', { count: 'exact', head: true }).eq('ip_hash', ipHash).gte('created_at', since)
  ]);
  return (byPhone.count ?? 0) >= PER_PHONE || (byVisitor.count ?? 0) >= PER_VISITOR;
}

export async function recordFailure(phone: string, ipHash: string) {
  await supabaseAdmin.from('customer_login_failures').insert({ phone, ip_hash: ipHash });
}
