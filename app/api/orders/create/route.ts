import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
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

  // A logged-in customer's session always wins over whatever (optional) phone
  // number they typed into the form -- otherwise an order placed while logged
  // in but with that field left blank, or filled in with a differently
  // formatted number, would never show up on their own /account/orders.
  let customerId: number | null = getCustomerId();

  if (!customerId && contactPhone) {
    const digits = contactPhone.replace(/\D/g, '');
    const { data: existing } = await supabaseAdmin.from('customers').select('id').eq('phone', digits).maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('customers')
        .insert({ phone: digits, name: contactName || null })
        .select('id')
        .single();
      if (!error && created) customerId = created.id;
    }
  }

  if (customerId && contactName) {
    await supabaseAdmin.from('customers').update({ name: contactName }).eq('id', customerId);
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
