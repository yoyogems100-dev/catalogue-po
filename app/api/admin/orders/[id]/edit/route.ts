import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCategoryPricing } from '@/lib/pricing';
import { lineInrPrice } from '@/lib/pricing-calc';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { data: order } = await supabaseAdmin.from('orders').select('id').eq('id', orderId).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { updates, removedIds, newItems } = await req.json();

  for (const u of Array.isArray(updates) ? updates : []) {
    if (!u?.id || typeof u.quantity !== 'number' || u.quantity < 1) continue;
    await supabaseAdmin.from('order_items').update({ quantity: u.quantity }).eq('id', u.id).eq('order_id', orderId);
  }

  if (Array.isArray(removedIds) && removedIds.length > 0) {
    await supabaseAdmin.from('order_items').delete().in('id', removedIds).eq('order_id', orderId);
  }

  const validRawNewItems = (Array.isArray(newItems) ? newItems : [])
    .filter((n: any) => n.categoryId && n.shapeId && n.sizeId && n.colorId && n.quantity > 0);
  const newItemCategoryIds = [...new Set(validRawNewItems.map((n: any) => n.categoryId))];
  const newItemPricingByCategory = new Map(
    await Promise.all(newItemCategoryIds.map(async (id) => [id, await getCategoryPricing(id, supabaseAdmin)] as const))
  );
  const validNewItems = validRawNewItems.map((n: any) => {
    const pricing = newItemPricingByCategory.get(n.categoryId);
    const unitPrice = pricing ? lineInrPrice(pricing, n.shapeId, n.sizeId, n.colorId) : null;
    return {
      order_id: orderId,
      category_id: n.categoryId,
      shape_id: n.shapeId,
      shape_size_id: n.sizeId,
      color_id: n.colorId,
      quantity: n.quantity,
      unit_price: unitPrice
    };
  });

  if (validNewItems.length > 0) {
    await supabaseAdmin.from('order_items').insert(validNewItems);
  }

  await supabaseAdmin.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabaseAdmin.from('order_notes').insert({
    order_id: orderId,
    author_type: 'admin',
    message: 'Order edited by admin (offline/phone request)',
    internal_only: false
  });

  return NextResponse.json({ ok: true });
}
