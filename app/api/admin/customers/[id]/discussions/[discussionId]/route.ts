import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { discussionFromBody } from '@/lib/discussions';

type Ctx = { params: Promise<{ id: string; discussionId: string }> };

async function ids(ctx: Ctx) {
  const p = await ctx.params;
  const customerId = Number(p.id), discussionId = Number(p.discussionId);
  const ok = [customerId, discussionId].every((n) => Number.isSafeInteger(n) && n > 0);
  return ok ? { customerId, discussionId } : null;
}

/** Edit one discussion. PATCH { heldOn, place, items, notes } */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const target = await ids(ctx);
  if (!target) return NextResponse.json({ error: 'Invalid discussion.' }, { status: 400 });
  const parsed = discussionFromBody(await request.json().catch(() => null), target.customerId);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('customer_discussions')
    .update({ ...parsed.values, updated_at: new Date().toISOString() })
    .eq('id', target.discussionId).eq('customer_id', target.customerId).select('id').maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!data) return NextResponse.json({ error: 'Discussion not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const target = await ids(ctx);
  if (!target) return NextResponse.json({ error: 'Invalid discussion.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('customer_discussions')
    .delete().eq('id', target.discussionId).eq('customer_id', target.customerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
