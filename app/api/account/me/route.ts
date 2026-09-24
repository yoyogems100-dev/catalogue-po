import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

// Added for the mobile app (Phase 4) -- given just a bearer token (or cookie), returns
// who's logged in. The app uses this to decide whether to show the one-time profile
// prompt (name still null) and to populate the Profile tab, without needing to store
// customer details client-side across sessions.
export async function GET() {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  // '*' and then pick: listing order_preferences by name would fail the whole
  // read -- signing everyone out -- if this ships before its migration runs.
  const { data: row } = await supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle();

  if (!row) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

  const { id, name, company, phone, email, phone_verified, email_verified, work_stream, go_to_requirements } = row;
  const customer = { id, name, company, phone, email, phone_verified, email_verified, work_stream, go_to_requirements, order_preferences: row.order_preferences || [] };
  return NextResponse.json({ customer });
}
