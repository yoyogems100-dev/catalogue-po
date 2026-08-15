import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { sendWhatsAppTemplate, WHATSAPP_TEMPLATES } from '@/lib/wasarthi';
import { milestoneLabel } from '@/lib/order-milestones';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { data: order } = await supabaseAdmin.from('orders').select('id, status, customer_id').eq('id', orderId).single();
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const { data: customer } = order.customer_id
    ? await supabaseAdmin.from('customers').select('phone, name').eq('id', order.customer_id).single()
    : { data: null };

  if (!customer?.phone) {
    return NextResponse.json({ error: 'No phone number on file for this customer' }, { status: 400 });
  }

  const statusLabel = milestoneLabel(order.status);
  const result = await sendWhatsAppTemplate(customer.phone, WHATSAPP_TEMPLATES.orderStatus, [
    customer.name || 'there',
    String(orderId),
    statusLabel
  ]);

  const { data: latestHistory } = await supabaseAdmin
    .from('order_status_history')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', order.status)
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestHistory) {
    await supabaseAdmin.from('order_status_history').update({ message_sent: true }).eq('id', latestHistory.id);
  }

  return NextResponse.json(result);
}
