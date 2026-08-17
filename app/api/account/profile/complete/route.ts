import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

// One-time profile completion (Phase 3 Part 2). Requires an active session -- this
// is never a signup form, only ever a follow-up to a verified phone/email login.
export async function POST(req: NextRequest) {
  const customerId = getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { name, company } = await req.json();
  const trimmedName = (name || '').trim();
  const trimmedCompany = (company || '').trim();

  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('customers')
    .update({ name: trimmedName, company: trimmedCompany || null })
    .eq('id', customerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
