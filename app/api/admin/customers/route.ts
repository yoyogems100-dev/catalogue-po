import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizePhone } from '@/lib/phone';
import { CUSTOMER_PLACES } from '@/lib/customer-places';

// Create a customer from the admin directory, for the common case where the
// team takes an enquiry on the phone before the buyer has ever signed in.
//
// Phone goes through normalizePhone so a customer entered here matches the same
// person when they later sign in themselves -- entering "+91 90799 14601" by
// hand used to create a second, separate record.
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const name = String(body.name || '').trim();
  const company = String(body.company || '').trim();
  if (!name && !company) {
    return NextResponse.json({ error: 'Enter a name or a company.' }, { status: 400 });
  }

  const phone = normalizePhone(body.phone);
  if (phone) {
    const { data: existing } = await supabaseAdmin.from('customers').select('id').eq('phone', phone).maybeSingle();
    // Never quietly create a duplicate -- send the team to the record they
    // already have instead.
    if (existing) return NextResponse.json({ id: existing.id, existed: true });
  }

  const place = typeof body.place === 'string' && (CUSTOMER_PLACES as readonly string[]).includes(body.place)
    ? body.place
    : null;

  const { data, error } = await supabaseAdmin.from('customers').insert({
    name: name || null,
    company: company || null,
    phone: phone || null,
    place,
    work_stream: String(body.workStream || '').trim() || null,
    go_to_requirements: String(body.goToRequirements || '').trim().slice(0, 500) || null
  }).select('id').single();

  if (error || !data) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'That phone number is already registered to another customer.' }, { status: 409 });
    }
    return NextResponse.json({ error: error?.message || 'Could not create customer.' }, { status: 400 });
  }

  return NextResponse.json({ id: data.id });
}
