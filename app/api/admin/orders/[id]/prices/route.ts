import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Prices are optional -- pass null/empty to clear a price back out.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { prices } = await req.json();

  for (const p of Array.isArray(prices) ? prices : []) {
    if (!p?.itemId) continue;
    const value = p.unitPrice === '' || p.unitPrice === null || p.unitPrice === undefined ? null : Number(p.unitPrice);
    if (value !== null && (Number.isNaN(value) || value < 0)) continue;
    await supabaseAdmin.from('order_items').update({ unit_price: value }).eq('id', p.itemId).eq('order_id', orderId);
  }

  return NextResponse.json({ ok: true });
}
