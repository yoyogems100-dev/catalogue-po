import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { decryptForAdmin, passwordProblem } from '@/lib/customer-password';
import { getCredentials, savePassword } from '@/lib/customer-credentials';
import { withoutAccessRequest } from '@/lib/access-requests';

async function customerId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// The customer's password as the admin sees it. Asked for separately (the
// Show button), so the page itself never carries it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await customerId(params);
  if (!id) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const creds = await getCredentials(id);
  if (!creds) return NextResponse.json({ hasPassword: false });
  const password = decryptForAdmin(creds.password_enc);
  return NextResponse.json({ hasPassword: true, password, viewable: password !== null, setAt: creds.set_at, setBy: creds.set_by });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await customerId(params);
  if (!id) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const problem = passwordProblem(body.password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  const { data: customer } = await supabaseAdmin.from('customers').select('id, phone, tags').eq('id', id).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  if (!customer.phone) return NextResponse.json({ error: 'Add a WhatsApp number first -- it is what they sign in with.' }, { status: 400 });
  await savePassword(id, body.password, 'admin');
  // A PIN answers their access request, so it leaves the admin overview.
  const tags = withoutAccessRequest(customer.tags);
  if (tags.length !== (customer.tags || []).length) await supabaseAdmin.from('customers').update({ tags }).eq('id', id);
  return NextResponse.json({ ok: true });
}
