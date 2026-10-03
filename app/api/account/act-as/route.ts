import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ACTING_HOURS, actingCookieName, canOrderForOthers, getCustomerSession, signActingToken } from '@/lib/customer-auth';

// "Ordering for": a customer allowed to order for others (customers.
// can_order_for_others, set on the admin customer page) picks any buyer and
// then uses /po as that buyer -- their catalogue, cart, orders -- until they
// switch back. GET lists the buyers; POST switches.

async function actor() {
  const session = await getCustomerSession();
  if (!session) return { error: NextResponse.json({ error: 'Sign in to continue' }, { status: 401 }) };
  if (!(await canOrderForOthers(session.actorId))) return { error: NextResponse.json({ error: 'This account cannot order for other customers.' }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const { session, error } = await actor();
  if (error) return error;
  const { data, error: dbError } = await supabaseAdmin.from('customers')
    .select('id, name, company, place, phone')
    .is('deleted_at', null)
    .order('name', { ascending: true, nullsFirst: false })
    .limit(1000);
  if (dbError) return NextResponse.json({ error: 'Could not load customers. Please retry.' }, { status: 503 });
  return NextResponse.json({ customers: data || [], current: session.customerId, self: session.actorId });
}

export async function POST(req: NextRequest) {
  const { session, error } = await actor();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const buyerId = Number(body.customerId);
  const res = NextResponse.json({ ok: true });
  // Back to yourself.
  if (!buyerId || buyerId === session.actorId) {
    res.cookies.delete(actingCookieName());
    return res;
  }
  if (!Number.isSafeInteger(buyerId) || buyerId < 1) return NextResponse.json({ error: 'Choose a customer.' }, { status: 400 });
  const { data: buyer } = await supabaseAdmin.from('customers').select('id').eq('id', buyerId).is('deleted_at', null).maybeSingle();
  if (!buyer) return NextResponse.json({ error: 'That customer no longer exists.' }, { status: 404 });
  res.cookies.set(actingCookieName(), signActingToken(session.actorId, buyerId), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * ACTING_HOURS
  });
  return res;
}
