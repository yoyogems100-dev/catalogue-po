import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizePhone } from '@/lib/phone';
import { ACCESS_REQUEST_TAG } from '@/lib/access-requests';
import { getCredentials } from '@/lib/customer-credentials';
import { notifyAdmin } from '@/lib/notify-admin';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (value: unknown, max: number) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '');

// Sign up = ask for access. Saves (or finds) the customer by phone number and
// tags them so the request shows on the admin overview. Signs nobody in and
// never says whether the number already had an account.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const phone = normalizePhone(body.phone);
  const name = clip(body.name, 120);
  const company = clip(body.company, 160);
  if (!name && !company) return NextResponse.json({ error: 'Enter your name or your company name.' }, { status: 400 });
  if (phone.length < 10) return NextResponse.json({ error: 'Enter a valid WhatsApp number.' }, { status: 400 });
  const email = clip(body.email, 200).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Enter a valid email address, or leave it empty.' }, { status: 400 });
  const workStream = Array.isArray(body.dealsIn) ? body.dealsIn.map((d: unknown) => clip(d, 60)).filter(Boolean).slice(0, 12).join(', ') : '';
  const goTo = clip(body.goToRequirements, 500);

  const { data: existing } = await supabaseAdmin.from('customers').select('id, name, company, email, tags, deleted_at, work_stream, go_to_requirements').eq('phone', phone).maybeSingle();
  if (existing && !existing.deleted_at) {
    // Already able to sign in: nothing for the team to do.
    if (await getCredentials(existing.id)) return NextResponse.json({ ok: true });
    const tags: string[] = existing.tags || [];
    const update: Record<string, unknown> = {};
    if (!tags.includes(ACCESS_REQUEST_TAG)) update.tags = [...tags, ACCESS_REQUEST_TAG];
    // Fill gaps only -- never overwrite what the team already has on file.
    if (!existing.name && name) update.name = name;
    if (!existing.company && company) update.company = company;
    if (!existing.email && email) update.email = email;
    if (!existing.work_stream && workStream) update.work_stream = workStream;
    if (!existing.go_to_requirements && goTo) update.go_to_requirements = goTo;
    if (Object.keys(update).length) {
      const { error } = await supabaseAdmin.from('customers').update(update).eq('id', existing.id);
      if (error) return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 500 });
    }
    // Only a fresh request is news; asking again while one is waiting is not.
    if (!tags.includes(ACCESS_REQUEST_TAG)) notifyAccess(existing.name || name, existing.company || company, phone);
    return NextResponse.json({ ok: true });
  }
  if (existing?.deleted_at) return NextResponse.json({ error: 'Could not send your request. Please contact us on WhatsApp.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('customers').insert({
    phone,
    name: name || null,
    company: company || null,
    email: email || null,
    work_stream: workStream || null,
    go_to_requirements: goTo || null,
    tags: [ACCESS_REQUEST_TAG],
    phone_verified: false
  });
  if (error) return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 500 });
  notifyAccess(name, company, phone);
  return NextResponse.json({ ok: true });
}

function notifyAccess(name: string, company: string, phone: string) {
  const who = [name, company].filter(Boolean).join(', ') || phone;
  notifyAdmin({ type: 'access_request', message: `Sign-up request from ${who} -- set a PIN to let them in`, link: '/admin#access-requests' });
}
