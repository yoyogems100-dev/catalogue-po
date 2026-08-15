import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

type CartItem = {
  categoryId: number;
  categoryName: string;
  shapeId: number;
  shapeName: string;
  sizeId: number;
  sizeMm: string;
  colorId: number;
  colorName: string;
  qty: number;
};

function buildMessage(cart: CartItem[], requestType: string, contactName: string, comment: string) {
  const rows = cart.map((item) => ({
    category: item.categoryName,
    shape: item.shapeName,
    size: item.sizeMm,
    color: item.colorName,
    qty: String(item.qty)
  }));

  const uniqueCategories = [...new Set(rows.map((r) => r.category))];
  const title = uniqueCategories.length === 1 ? uniqueCategories[0] : 'YOYO GEMS Requirement';

  const w = (key: keyof (typeof rows)[number], label: string) =>
    Math.max(label.length, ...rows.map((r) => r[key].length));
  const catW = w('category', 'Category');
  const shapeW = w('shape', 'Shape');
  const sizeW = w('size', 'Size');
  const colorW = w('color', 'Color');
  const qtyW = w('qty', 'Qty');

  const pad = (s: string, n: number, end = true) => (end ? s.padEnd(n) : s.padStart(n));

  const header = `${pad('Category', catW)}  ${pad('Shape', shapeW)}  ${pad('Size', sizeW)}  ${pad('Color', colorW)}  ${pad('Qty', qtyW, false)}`;
  const divider = `${'-'.repeat(catW)}  ${'-'.repeat(shapeW)}  ${'-'.repeat(sizeW)}  ${'-'.repeat(colorW)}  ${'-'.repeat(qtyW)}`;
  const lines = rows.map(
    (r) => `${pad(r.category, catW)}  ${pad(r.shape, shapeW)}  ${pad(r.size, sizeW)}  ${pad(r.color, colorW)}  ${pad(r.qty, qtyW, false)}`
  );

  return [
    'Hello YOYO GEMS,',
    '',
    `*${title}*`,
    `Request Type: ${requestType}`,
    contactName ? `Name / Company: ${contactName}` : '',
    '',
    'Requirement:',
    '```',
    header,
    divider,
    ...lines,
    '```',
    '',
    comment ? `Additional Comment: ${comment}` : '',
    '',
    'Thank you.'
  ]
    .filter((line, i, arr) => line !== '' || arr[i - 1] !== '')
    .join('\n');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cart: CartItem[] = Array.isArray(body.cart) ? body.cart : [];
  const requestType: string = body.requestType || 'Place Order';
  const contactName: string = (body.contactName || '').trim();
  const contactPhone: string = (body.contactPhone || '').trim();
  const comment: string = (body.comment || '').trim();

  if (cart.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  let customerId: number | null = null;
  if (contactPhone) {
    const digits = contactPhone.replace(/\D/g, '');
    const { data: existing } = await supabaseAdmin.from('customers').select('id').eq('phone', digits).maybeSingle();
    if (existing) {
      customerId = existing.id;
      if (contactName) await supabaseAdmin.from('customers').update({ name: contactName }).eq('id', existing.id);
    } else {
      const { data: created, error } = await supabaseAdmin
        .from('customers')
        .insert({ phone: digits, name: contactName || null })
        .select('id')
        .single();
      if (!error && created) customerId = created.id;
    }
  }

  const message = buildMessage(cart, requestType, contactName, comment);

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
