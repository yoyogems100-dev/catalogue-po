import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { orderStageMessage } from '@/lib/order-stages-server';

// Admin only: the WhatsApp text for an order's current stage, built from the
// wording in Orders > Stages & messages. Used by the Notify button on the
// orders list, which doesn't load each buyer's PIN up front.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orderId = Number((await params).id);
  if (!Number.isInteger(orderId) || orderId <= 0) return NextResponse.json({ error: 'Invalid order' }, { status: 400 });
  const message = await orderStageMessage(orderId);
  if (!message) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json(message, { headers: { 'Cache-Control': 'no-store' } });
}
