import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCustomerId } from '@/lib/customer-auth';

// JSON equivalent of app/account/orders/page.tsx -- powers the app's My Orders list.
// Auth via getCustomerId(), which accepts the app's Bearer token the same as the
// web cookie.
export async function GET() {
  const customerId = getCustomerId();
  if (!customerId) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const { data: orders } = await supabaseAdmin
    .from('orders')
    .select('id, status, created_at, payment_status')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  const orderIds = (orders || []).map((o: any) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin.from('order_items').select('order_id, quantity').in('order_id', orderIds)
    : { data: [] };

  const statsByOrder: Record<number, { lines: number; pieces: number }> = {};
  (items || []).forEach((it: any) => {
    if (!statsByOrder[it.order_id]) statsByOrder[it.order_id] = { lines: 0, pieces: 0 };
    statsByOrder[it.order_id].lines += 1;
    statsByOrder[it.order_id].pieces += it.quantity;
  });

  const ordersFormatted = (orders || []).map((o: any) => ({
    id: o.id,
    status: o.status,
    created_at: o.created_at,
    payment_status: o.payment_status,
    lines: statsByOrder[o.id]?.lines || 0,
    pieces: statsByOrder[o.id]?.pieces || 0
  }));

  return NextResponse.json({ orders: ordersFormatted });
}
