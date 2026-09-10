import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Prices are optional -- pass null/empty to clear a price back out.
export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { prices } = await req.json();

  if (!Array.isArray(prices) || prices.length === 0 || prices.some(p =>
    !Number.isSafeInteger(p?.itemId) || p.itemId <= 0 ||
    !(p.unitPrice === '' || p.unitPrice === null ||
      ((typeof p.unitPrice === 'string' || typeof p.unitPrice === 'number') &&
        /^\d+(\.\d+)?$/.test(String(p.unitPrice).trim()) && Number.isFinite(Number(p.unitPrice))))
  )) return NextResponse.json({ error: 'Enter valid non-negative prices or leave them blank.' }, { status: 400 });

  for (const p of prices) {
    const value = p.unitPrice === '' || p.unitPrice === null ? null : Number(p.unitPrice);
    const { data, error } = await supabaseAdmin.from('order_items').update({ unit_price: value })
      .eq('id', p.itemId).eq('order_id', orderId).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Could not save every price. Some may have saved; review and retry.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
