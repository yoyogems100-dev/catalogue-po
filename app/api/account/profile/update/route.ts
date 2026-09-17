import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The "My Info" edit page -- unlike /api/account/profile/complete (a one-time
// gate that only ever fills in blanks), this can be called repeatedly and
// always overwrites name/company/deals-in/requirements with what's submitted.
// Phone is intentionally never accepted here: it's the customer's login
// identity, so changing it belongs in a re-verification flow, not a plain
// text field.
export async function POST(req: NextRequest) {
  const customerId = await getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { data: existing } = await supabaseAdmin.from('customers').select('email, email_verified').eq('id', customerId).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Account not found' }, { status: 404 });

  const { name, company, dealsIn, goToRequirements, email } = await req.json();
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const trimmedCompany = typeof company === 'string' ? company.trim() : '';

  if (!trimmedName && !trimmedCompany) {
    return NextResponse.json({ error: 'Enter your name or your company name' }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    name: trimmedName || null,
    company: trimmedCompany || null,
    work_stream: Array.isArray(dealsIn) ? dealsIn.filter((d) => typeof d === 'string' && d.trim()).join(', ') || null : null,
    go_to_requirements: typeof goToRequirements === 'string' ? goToRequirements.trim().slice(0, 500) || null : null
  };

  // Email can only be set once and never overwritten here -- once verified it's
  // another login identity, same reasoning as phone above.
  if (!existing.email && typeof email === 'string' && email.trim()) {
    const trimmedEmail = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
    }
    update.email = trimmedEmail;
  }

  const { error } = await supabaseAdmin.from('customers').update(update).eq('id', customerId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
