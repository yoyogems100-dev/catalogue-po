import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ORDER_MILESTONES } from '@/lib/order-milestones';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);
  const { status } = await req.json();

  if (!ORDER_MILESTONES.some((m) => m.key === status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabaseAdmin.from('order_status_history').insert({ order_id: orderId, status });

  return NextResponse.json({ ok: true });
}
