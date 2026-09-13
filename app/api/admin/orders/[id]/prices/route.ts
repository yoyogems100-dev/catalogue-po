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
        /^\d+(\.\d+)?$/.test(String(p.unitPrice).trim()) && Number.isFinite(Number(p.unitPrice)))) ||
    !(p.costPrice === '' || p.costPrice === null || p.costPrice === undefined ||
      ((typeof p.costPrice === 'string' || typeof p.costPrice === 'number') && /^\d+(\.\d+)?$/.test(String(p.costPrice).trim()) && Number.isFinite(Number(p.costPrice)))) ||
    !['INR', 'RMB'].includes(p.costCurrency || 'INR') ||
    !(p.supplierId === null || p.supplierId === '' || p.supplierId === undefined || (Number.isSafeInteger(Number(p.supplierId)) && Number(p.supplierId) > 0))
  )) return NextResponse.json({ error: 'Enter valid supplier, CP and SP values or leave them blank.' }, { status: 400 });

  for (const p of prices) {
    const value = p.unitPrice === '' || p.unitPrice === null ? null : Number(p.unitPrice);
    const costPrice = p.costPrice === '' || p.costPrice === null || p.costPrice === undefined ? null : Number(p.costPrice);
    const { data, error } = await supabaseAdmin.from('order_items').update({ unit_price: value, cost_price: costPrice, cost_currency: p.costCurrency || 'INR', supplier_id: p.supplierId || null })
      .eq('id', p.itemId).eq('order_id', orderId).select('id').maybeSingle();
    if (error || !data) return NextResponse.json({ error: 'Could not save every price. Some may have saved; review and retry.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
