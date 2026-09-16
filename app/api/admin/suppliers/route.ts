import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json(); const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Supplier name is required.' }, { status: 400 });
  const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.filter((id: unknown) => Number.isSafeInteger(id) && (id as number) > 0) : [];
  const { data, error } = await supabaseAdmin.from('suppliers').insert({
    name,
    company: String(body.company || '').trim() || null,
    address: String(body.address || '').trim() || null,
    phone: String(body.phone || '').trim() || null
  }).select('id').single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not create supplier.' }, { status: 400 });
  if (categoryIds.length) {
    const { error: linkError } = await supabaseAdmin.from('supplier_categories').insert(categoryIds.map((categoryId: number) => ({ supplier_id: data.id, category_id: categoryId })));
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id });
}
