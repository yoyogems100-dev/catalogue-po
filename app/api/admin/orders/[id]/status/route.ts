import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';
import { sendPushToCustomer } from '@/lib/expo-push';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { status } = await req.json();

  if (!ORDER_MILESTONES.some((m) => m.key === status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select('customer_id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from('order_status_history').insert({ order_id: orderId, status });

  // Push is automatic (free, low-risk) unlike WhatsApp notify which stays a manual
  // admin click -- doesn't block or fail the status update if it errors.
  if (order?.customer_id) {
    sendPushToCustomer(
      order.customer_id,
      'Order update',
      `Your YOYO GEMS order #${orderId} is now: ${milestoneLabel(status)}`,
      { orderId, status }
    ).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
