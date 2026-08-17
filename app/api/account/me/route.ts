import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

// Added for the mobile app (Phase 4) -- given just a bearer token (or cookie), returns
// who's logged in. The app uses this to decide whether to show the one-time profile
// prompt (name still null) and to populate the Profile tab, without needing to store
// customer details client-side across sessions.
export async function GET() {
  const customerId = getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, name, company, phone, email, phone_verified, email_verified')
    .eq('id', customerId)
    .maybeSingle();

  if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  return NextResponse.json({ customer });
}
