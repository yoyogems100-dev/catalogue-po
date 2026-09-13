import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One-time profile completion (Phase 3 Part 2). Requires an active session -- this
// is never a signup form, only ever a follow-up to a verified phone/email login.
export async function POST(req: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { data: existing } = await supabaseAdmin.from('customers').select('phone, email').eq('id', customerId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { name, phone, company, dealsIn, email } = await req.json();
  const trimmedName = (name || '').trim();
  const trimmedCompany = (company || '').trim();

  if (!trimmedName) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (!trimmedCompany) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
  }

  const update: Record<string, unknown> = { name: trimmedName, company: trimmedCompany };

  if (!existing.phone) {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    }
    update.phone = digits;
  }

  if (!existing.email && email) {
    const trimmedEmail = String(email).trim().toLowerCase();
    if (trimmedEmail) {
      if (!EMAIL_RE.test(trimmedEmail)) {
        return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
      }
      update.email = trimmedEmail;
    }
  }

  if (Array.isArray(dealsIn) && dealsIn.length > 0) {
    update.work_stream = dealsIn.filter((d) => typeof d === 'string' && d.trim()).join(', ');
  }

  const { error } = await supabaseAdmin.from('customers').update(update).eq('id', customerId);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That phone number is already registered to another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
