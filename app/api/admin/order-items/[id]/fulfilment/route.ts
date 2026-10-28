import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseSent, sentOf } from '@/lib/line-fulfilment';
import { catalogueChanged } from '@/lib/catalogue-cache';

// How much of one order line has been sent, and whether it is flagged to
// check. Team-only; the buyer sees the sent amount on their order.
export async function PATCH(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();
  const id = Number((await paramsPromise).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Invalid line' }, { status: 400 });
  const body = await req.json().catch(() => ({}));

  const { data: line, error: readError } = await supabaseAdmin.from('order_items').select('*').eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ error: 'Could not read the line. Please retry.' }, { status: 500 });
  if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 });
  if (!('sent_qty' in line)) {
    return NextResponse.json({ error: 'Delivery tracking is not switched on yet (database update pending).' }, { status: 409 });
  }

  const patch: { sent_qty?: number; needs_check?: boolean } = {};
  if ('sentQty' in body) {
    const sent = parseSent(body.sentQty, line.quantity);
    if (sent === null) return NextResponse.json({ error: 'Enter a whole number for the amount sent.' }, { status: 400 });
    patch.sent_qty = sent;
  }
  if ('needsCheck' in body) patch.needs_check = body.needsCheck === true;
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data: saved, error } = await supabaseAdmin.from('order_items').update(patch).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: 'Could not save. Please retry.' }, { status: 400 });
  return NextResponse.json({ sentQty: sentOf(saved), needsCheck: !!saved.needs_check });
}
