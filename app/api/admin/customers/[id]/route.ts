import { NextRequest, NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/phone';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const body = await request.json();
  const phone = normalizePhone(body.phone);
  if (phone && phone.length < 10) return NextResponse.json({ error: 'Enter a valid WhatsApp number.' }, { status: 400 });
  const values = {
    name: String(body.name || '').trim() || null,
    company: String(body.company || '').trim() || null,
    phone: phone || null,
    email: String(body.email || '').trim().toLowerCase() || null,
    work_stream: String(body.workStream || '').trim() || null,
    go_to_requirements: String(body.goToRequirements || '').trim() || null,
    place: String(body.place || '').trim() || null,
  };
  const { data, error } = await supabaseAdmin.from('customers').update(values).eq('id', id).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// Soft delete -- moves the customer to the Bin (hidden from the customers
// list). Their past orders keep their own record; orders.customer_id is set
// null by the database's own ON DELETE SET NULL, only if this is later
// permanently deleted from the Bin, not by this soft delete.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const { error } = await supabaseAdmin.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
