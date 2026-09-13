import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supplierId = Number((await params).id); const body = await request.json(); const costPrice = Number(body.costPrice); const categoryId = Number(body.categoryId);
  if (!Number.isSafeInteger(supplierId) || !Number.isSafeInteger(categoryId) || !Number.isFinite(costPrice) || costPrice < 0 || !['INR', 'RMB'].includes(body.currency)) return NextResponse.json({ error: 'Enter a valid category, price and currency.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('supplier_rates').insert({ supplier_id: supplierId, category_id: categoryId, shape_id: body.shapeId || null, shape_size_id: body.sizeId || null, color_id: body.colorId || null, cost_price: costPrice, currency: body.currency, notes: String(body.notes || '').trim() || null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 }); return NextResponse.json({ ok: true });
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supplierId = Number((await params).id), rateId = Number(new URL(request.url).searchParams.get('id'));
  const { data, error } = await supabaseAdmin.from('supplier_rates').delete().eq('id', rateId).eq('supplier_id', supplierId).select('id').maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Rate not found.' }, { status: 404 }); return NextResponse.json({ ok: true });
}
