import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DRAFTS_UNAVAILABLE, isMissingTable, listOrderDrafts } from '@/lib/order-drafts';
import { cleanDraftPayload } from '@/lib/order-draft-payload';

// Draft orders: list them, or save a new one. A draft is never an order --
// nothing here notifies anyone or touches the orders table.

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const drafts = await listOrderDrafts().catch((e: Error) => e);
  if (drafts instanceof Error) return NextResponse.json({ error: drafts.message }, { status: 500 });
  if (drafts === null) return NextResponse.json({ error: DRAFTS_UNAVAILABLE, unavailable: true }, { status: 503 });
  return NextResponse.json({ drafts });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = cleanDraftPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('order_drafts')
    .insert({ customer_id: parsed.customerId, payload: parsed.payload })
    .select('id, updated_at')
    .single();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: DRAFTS_UNAVAILABLE, unavailable: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ id: data.id, updatedAt: data.updated_at });
}
