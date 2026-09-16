import { validateOrderSpecs } from '@/lib/validate-order-specs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';
import { buildOrderMessage, type OrderCartItem } from '@/lib/order-message';
import { notifyAdmin } from '@/lib/notify-admin';
import { getCategoryPricing } from '@/lib/pricing';
import { lineInrPrice } from '@/lib/pricing-calc';
import { parseQuantity } from '@/lib/quantity';

export async function POST(req: NextRequest) {
  const body = await req.json();
  let cart: OrderCartItem[] = Array.isArray(body.cart)
    ? body.cart.map((item: OrderCartItem) => ({ ...item, requestType: item.requestType || 'Place Order' }))
    : [];
  const comment: string = (body.comment || '').trim();

  if (cart.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }
  // A quotation asks what something would cost, so its quantity is optional:
  // 0 is stored to mean "not specified" (order_items.quantity is NOT NULL).
  // Purchase lines still require a positive whole quantity, and a quotation
  // that DOES carry a quantity is held to the same bounds.
  if (cart.some((item) => {
    if (typeof item.qty !== 'number' || !Number.isInteger(item.qty) || item.qty < 0) return true;
    if (item.requestType === 'Request Quotation') return item.qty !== 0 && parseQuantity(String(item.qty)) === null;
    return parseQuantity(String(item.qty)) === null;
  })) {
    return NextResponse.json({ error: 'Every purchase line needs a positive whole quantity.' }, { status: 400 });
  }

  try { cart = await validateOrderSpecs(cart); } catch(error) { return NextResponse.json({error:error instanceof Error?error.message:'Invalid order options'},{status:400}); }

  // Sending a requirement now requires a verified account. Guest submissions
  // could arrive with no name and no number at all, leaving the team an order
  // they had no way to reply to -- and leaving the buyer no record of it. The
  // cart asks unauthenticated visitors to sign in before it offers Send; this
  // is the matching server-side rule, so the check can't be skipped.
  const customerId: number | null = await getCustomerId();
  if (!customerId) {
    return NextResponse.json(
      { error: 'Please sign in so we can confirm price and availability with you.' },
      { status: 401 }
    );
  }


  // Prices are always computed fresh here from the admin-set price/multiplier,
  // never trusted from the client -- a cart can span multiple categories, so
  // pricing is fetched once per distinct category present.
  const distinctCategoryIds = [...new Set(cart.map((i) => i.categoryId))];
  const pricingByCategory = new Map(
    await Promise.all(distinctCategoryIds.map(async (id) => [id, await getCategoryPricing(id, supabaseAdmin)] as const))
  );
  const cartWithPrices: OrderCartItem[] = cart.map((item) => {
    const pricing = pricingByCategory.get(item.categoryId);
    const unitPriceInr = !item.orderSpecs && pricing && item.sizeId != null ? lineInrPrice(pricing, item.shapeId, item.sizeId, item.colorId) : null;
    return { ...item, unitPriceInr };
  });

  const { data: customerRecord } = await supabaseAdmin
    .from('customers').select('name, company').eq('id', customerId).maybeSingle();
  const contactName = (customerRecord?.name || customerRecord?.company || '').trim();

  const message = buildOrderMessage(cartWithPrices, contactName, comment);

  // Order-level request_type is a summary for admin filtering/badges -- "Mixed"
  // when the cart has both Place Order and Request Quotation lines, since each
  // line now carries its own type (order_items.request_type is the source of truth).
  const distinctTypes = new Set(cart.map((i) => i.requestType));
  const orderLevelRequestType = distinctTypes.size > 1 ? 'Mixed' : cart[0]?.requestType || 'Place Order';

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      customer_id: customerId,
      status: 'placed',
      request_type: orderLevelRequestType,
      contact_name: contactName || null,
      comment: comment || null,
      whatsapp_message: message
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: orderError?.message || 'Failed to create order' }, { status: 400 });
  }

  const itemRows = cartWithPrices.map((item) => ({
    order_id: order.id,
    category_id: item.categoryId,
    shape_id: item.shapeId,
    shape_size_id: item.sizeId,
    // Custom size ranges (e.g. "0.7-1.5") don't have a shape_sizes row -- sizeId
    // is null for those, so the free-text label is persisted here instead.
    custom_size: item.sizeId == null ? item.sizeMm : null,
    color_id: item.colorId,
    quantity: item.qty,
    order_specs: item.orderSpecs || null,
    request_type: item.requestType,
    // Stored at creation time, not recomputed later -- so the PDF/order record
    // stays historically accurate even if the admin changes prices afterward.
    unit_price: item.unitPriceInr ?? null
  }));

  const { error: itemsError } = await supabaseAdmin.from('order_items').insert(itemRows);
  if (itemsError) {
    // The order row above already committed -- without this, a failed items
    // insert leaves a permanent zero-item "ghost" order (status 'placed') that
    // the customer never actually confirmed, polluting admin order history.
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: itemsError.message }, { status: 400 });
  }

  await supabaseAdmin.from('order_status_history').insert({ order_id: order.id, status: 'placed' });

  const pieceCount = cart.reduce((sum, i) => sum + i.qty, 0);
  // Best-effort by design (see lib/notify-admin.ts) -- fire-and-forget so a slow
  // or failed notification insert never delays the customer's confirmation.
  notifyAdmin(
    'new_order',
    order.id,
    `New order #${order.id} placed${contactName ? ` by ${contactName}` : ''} -- ${cart.length} line${cart.length > 1 ? 's' : ''}, ${pieceCount.toLocaleString('en-IN')} pcs`
  ).catch(() => {});

  return NextResponse.json({ orderId: order.id, message });
}
