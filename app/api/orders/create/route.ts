import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { findOrCreateCustomer } from '@/lib/customer-identity';
import { buildOrderMessage, type OrderCartItem } from '@/lib/order-message';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cart: OrderCartItem[] = Array.isArray(body.cart) ? body.cart : [];
  const requestType: string = body.requestType || 'Place Order';
  const contactName: string = (body.contactName || '').trim();
  const contactPhone: string = (body.contactPhone || '').trim();
  const comment: string = (body.comment || '').trim();

  if (cart.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  // Placing an order never requires auth -- this phone field is optional and
  // unverified, just used to address a notification about this one order (Phase 3
  // Part 0). A logged-in session still wins when present, purely so the order shows
  // up in their own history automatically; it's not a requirement to place one.
  let customerId: number | null = getCustomerId();

  if (!customerId && contactPhone) {
    const identity = await findOrCreateCustomer({ phone: contactPhone });
    customerId = identity.id;
  }

  // Never overwrite a name that's already on file (e.g. from Phase 3 profile
  // completion) -- only fill it in if the customer genuinely has none yet.
  if (customerId && contactName) {
    const { data: existing } = await supabaseAdmin.from('customers').select('name').eq('id', customerId).maybeSingle();
    if (!existing?.name) {
      await supabaseAdmin.from('customers').update({ name: contactName }).eq('id', customerId);
    }
  }

  const message = buildOrderMessage(cart, requestType, contactName, comment);

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'placed',
      request_type: requestType,
      contact_name: contactName || null,
      comment: comment || null,
      whatsapp_message: message
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Failed to create order' }, { status: 400 });
  }

  const itemRows = cart.map((item) => ({
    order_id: order.id,
    category_id: item.categoryId,
    shape_id: item.shapeId,
    shape_size_id: item.sizeId,
    // Custom size ranges (e.g. "0.7-1.5") don't have a shape_sizes row -- sizeId
    // is null for those, so the free-text label is persisted here instead.
    custom_size: item.sizeId == null ? item.sizeMm : null,
    color_id: item.colorId,
    quantity: item.qty
  }));

  const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemRows);
  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  await supabaseAdmin.from('order_status_history').insert({ order_id: order.id, status: 'placed' });

  return NextResponse.json({ orderId: order.id, message });
}
