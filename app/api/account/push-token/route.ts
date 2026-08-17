import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

// Called by the app right after login (and again whenever Expo hands it a fresh
// token, which can happen). Upsert on (customer_id, expo_push_token) so re-registering
// the same device/token pair is a no-op instead of piling up duplicate rows.
export async function POST(req: NextRequest) {
  const customerId = getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { expoPushToken } = await req.json();
  if (!expoPushToken || typeof expoPushToken !== 'string') {
    return NextResponse.json({ error: 'expoPushToken required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('push_tokens')
    .upsert({ customer_id: customerId, expo_push_token: expoPushToken }, { onConflict: 'customer_id,expo_push_token' });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
