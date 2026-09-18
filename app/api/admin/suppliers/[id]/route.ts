import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id); const body = await request.json(); const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Supplier name is required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('suppliers').update({ name, company: String(body.company || '').trim() || null, address: String(body.address || '').trim() || null, contact_name: String(body.contactName || '').trim() || null, phone: String(body.phone || '').trim() || null, email: String(body.email || '').trim().toLowerCase() || null, notes: String(body.notes || '').trim() || null, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const ids = Array.isArray(body.categoryIds) ? body.categoryIds.map(Number).filter((value: number) => Number.isSafeInteger(value) && value > 0) : [];
  const deleted = await supabaseAdmin.from('supplier_categories').delete().eq('supplier_id', id); if (deleted.error) return NextResponse.json({ error: deleted.error.message }, { status: 400 });
  if (ids.length) { const inserted = await supabaseAdmin.from('supplier_categories').insert(ids.map((categoryId: number) => ({ supplier_id: id, category_id: categoryId }))); if (inserted.error) return NextResponse.json({ error: inserted.error.message }, { status: 400 }); }
  return NextResponse.json({ ok: true });
}

// Soft delete -- moves the supplier to the Bin (hidden from the suppliers
// list) instead of destroying it.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const { error } = await supabaseAdmin.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
