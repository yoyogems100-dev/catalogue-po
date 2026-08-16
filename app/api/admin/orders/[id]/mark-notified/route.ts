import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Best-effort record that admin clicked "Notify via WhatsApp" -- there's no way to
// confirm the message was actually sent from the manual wa.me flow, only that this
// was clicked. Marks the most recent status-history entry so the timeline shows it.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orderId = Number(params.id);

  const { data: latestHistory } = await supabaseAdmin
    .from('order_status_history')
    .select('id')
    .eq('order_id', orderId)
    .order('changed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestHistory) {
    await supabaseAdmin.from('order_status_history').update({ message_sent: true }).eq('id', latestHistory.id);
  }

  return NextResponse.json({ ok: true });
}
