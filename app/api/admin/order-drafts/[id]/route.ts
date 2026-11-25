import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DRAFTS_UNAVAILABLE, isMissingTable } from '@/lib/order-drafts';
import { cleanDraftPayload } from '@/lib/order-draft-payload';

// One draft order: save it again (PUT) or delete it. Placing it as a real
// order goes through /api/admin/orders/create, which deletes the draft.

async function draftId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await draftId(params);
  if (!id) return NextResponse.json({ error: 'Bad draft' }, { status: 400 });
  const parsed = cleanDraftPayload(await req.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('order_drafts')
    .update({ customer_id: parsed.customerId, payload: parsed.payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, updated_at')
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: DRAFTS_UNAVAILABLE, unavailable: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  // Deleted meanwhile (another tab placed or deleted it): tell the builder so
  // it can save a fresh draft instead of losing the work.
  if (!data) return NextResponse.json({ error: 'This draft was deleted or already placed.', gone: true }, { status: 404 });
  return NextResponse.json({ id: data.id, updatedAt: data.updated_at });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = await draftId(params);
  if (!id) return NextResponse.json({ error: 'Bad draft' }, { status: 400 });
  const { error } = await supabaseAdmin.from('order_drafts').delete().eq('id', id);
  if (error) {
    if (isMissingTable(error)) return NextResponse.json({ error: DRAFTS_UNAVAILABLE, unavailable: true }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
