import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizePacketWeights } from '@/lib/packet-weights';

/** Saves an order's packet weights. PUT { mode, packets: [{ categoryId,
 *  shapeId, sizeId, weight, unit }] } -- packets without a weight are left
 *  out; an empty list clears them. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orderId = Number((await params).id);
  if (!Number.isSafeInteger(orderId) || orderId < 1) return NextResponse.json({ error: 'Invalid order.' }, { status: 400 });
  const value = normalizePacketWeights(await req.json().catch(() => null));
  if (!value) return NextResponse.json({ error: 'Enter each weight as a number above 0, in g or ct.' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ packet_weights: value.packets.length ? value : null })
    .eq('id', orderId)
    .select('id')
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Order not found.' }, { status: error ? 500 : 404 });
  return NextResponse.json({ ok: true, packetWeights: value.packets.length ? value : null });
}
