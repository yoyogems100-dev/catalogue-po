import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { normalizePhone } from '@/lib/phone';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// One-time profile completion (Phase 3 Part 2). Requires an active session -- this
// is never a signup form, only ever a follow-up to a verified phone/email login.
export async function POST(req: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { data: existing } = await supabaseAdmin.from('customers').select('phone, email').eq('id', customerId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { name, phone, company, dealsIn, goToRequirements, email } = await req.json();
  const trimmedName = (name || '').trim();
  const trimmedCompany = (company || '').trim();

  if (!trimmedName && !trimmedCompany) {
    return NextResponse.json({ error: 'Enter your name or your company name' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (trimmedName) update.name = trimmedName;
  if (trimmedCompany) update.company = trimmedCompany;

  if (!existing.phone) {
    const digits = normalizePhone(phone);
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

  // What they usually buy -- the single most useful thing for the team to have
  // on file before a first conversation. Optional, and never overwritten with
  // a blank if they skip it on a later pass.
  const trimmedGoTo = typeof goToRequirements === 'string' ? goToRequirements.trim() : '';
  if (trimmedGoTo) update.go_to_requirements = trimmedGoTo.slice(0, 500);

  const { error } = await supabaseAdmin.from('customers').update(update).eq('id', customerId);

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That phone number is already registered to another account.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
