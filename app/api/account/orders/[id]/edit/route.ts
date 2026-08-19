import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { milestoneIndex } from '@/lib/order-milestones';
import { notifyAdmin } from '@/lib/notify-admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const customerId = getCustomerId();
  if (!customerId) {
    return NextResponse.json({ error: 'Not logged in' }, { status: 401 });
  }

  const orderId = Number(params.id);
  const { data: order } = await supabaseAdmin.from('orders').select('id, customer_id, status').eq('id', orderId).single();

  if (!order || order.customer_id !== customerId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  // Editable any time before it actually ships -- matches the frontend's canEdit.
  if (milestoneIndex(order.status) < 0 || milestoneIndex(order.status) >= milestoneIndex('shipped')) {
    return NextResponse.json({ error: 'This order can no longer be edited' }, { status: 400 });
  }

  const { updates, removedIds, newItems } = await req.json();

  for (const u of Array.isArray(updates) ? updates : []) {
    if (!u?.id || typeof u.quantity !== 'number' || u.quantity < 1) continue;
    await supabaseAdmin.from('order_items').update({ quantity: u.quantity }).eq('id', u.id).eq('order_id', orderId);
  }

  if (Array.isArray(removedIds) && removedIds.length > 0) {
    await supabaseAdmin.from('order_items').delete().in('id', removedIds).eq('order_id', orderId);
  }

  const validNewItems = (Array.isArray(newItems) ? newItems : [])
    .filter((n: any) => n.categoryId && n.shapeId && n.sizeId && n.colorId && n.quantity > 0)
    .map((n: any) => ({
      order_id: orderId,
      category_id: n.categoryId,
      shape_id: n.shapeId,
      shape_size_id: n.sizeId,
      color_id: n.colorId,
      quantity: n.quantity,
      request_type: n.requestType || 'Place Order'
    }));

  if (validNewItems.length > 0) {
    await supabaseAdmin.from('order_items').insert(validNewItems);
  }

  await supabaseAdmin.from('orders').update({ updated_at: new Date().toISOString() }).eq('id', orderId);
  await supabaseAdmin.from('order_notes').insert({
    order_id: orderId,
    author_type: 'customer',
    message: 'Order edited by customer',
    internal_only: false
  });

  const changeParts = [
    updates.length > 0 ? `${updates.length} qty change${updates.length > 1 ? 's' : ''}` : null,
    Array.isArray(removedIds) && removedIds.length > 0 ? `${removedIds.length} line${removedIds.length > 1 ? 's' : ''} removed` : null,
    validNewItems.length > 0 ? `${validNewItems.length} line${validNewItems.length > 1 ? 's' : ''} added` : null
  ].filter(Boolean);
  await notifyAdmin('order_modified', orderId, `Order #${orderId} modified by customer (${changeParts.join(', ') || 'changes saved'})`);

  return NextResponse.json({ ok: true });
}
