import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withoutAccessRequest } from '@/lib/access-requests';

/** Dismisses a customer's access request without giving them a PIN. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const { data: customer } = await supabaseAdmin.from('customers').select('tags').eq('id', id).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  const { error } = await supabaseAdmin.from('customers').update({ tags: withoutAccessRequest(customer.tags) }).eq('id', id);
  if (error) return NextResponse.json({ error: 'Could not dismiss the request.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
