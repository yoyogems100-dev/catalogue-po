import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { buildOrderMessage, type OrderCartItem } from '@/lib/order-message';

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const cart: OrderCartItem[] = Array.isArray(body.cart) ? body.cart : [];
  const requestType: string = body.requestType || 'Place Order';
  const comment: string = (body.comment || '').trim();
  const existingCustomerId: number | null = body.customerId ? Number(body.customerId) : null;
  const newCustomerPhone: string = (body.newCustomerPhone || '').trim();
  const newCustomerName: string = (body.newCustomerName || '').trim();

  if (cart.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  let customerId: number | null = null;
  let contactName: string | null = null;

  if (existingCustomerId) {
    const { data: existing } = await supabaseAdmin.from('customers').select('id, name').eq('id', existingCustomerId).maybeSingle();
    if (!existing) return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
    customerId = existing.id;
    contactName = existing.name;
  } else if (newCustomerPhone) {
    const digits = newCustomerPhone.replace(/\D/g, '');
    if (digits.length < 10) return NextResponse.json({ error: 'Enter a valid phone number' }, { status: 400 });
    const { data: existing } = await supabaseAdmin.from('customers').select('id, name').eq('phone', digits).maybeSingle();
    if (existing) {
      customerId = existing.id;
      contactName = existing.name;
      if (newCustomerName) {
        await supabaseAdmin.from('customers').update({ name: newCustomerName }).eq('id', existing.id);
        contactName = newCustomerName;
      }
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('customers')
        .insert({ phone: digits, name: newCustomerName || null })
        .select('id')
        .single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'Failed to create customer' }, { status: 400 });
      customerId = created.id;
      contactName = newCustomerName || null;
    }
  }

  const message = buildOrderMessage(cart, requestType, contactName || '', comment);

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'placed',
      request_type: requestType,
      contact_name: contactName,
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
  await supabaseAdmin.from('order_notes').insert({
    order_id: order.id,
    author_type: 'admin',
    message: 'Order created by admin (offline/phone request)',
    internal_only: false
  });

  return NextResponse.json({ orderId: order.id });
}
