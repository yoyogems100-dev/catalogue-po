import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { discussionFromBody } from '@/lib/discussions';

/** Add a discussion for one buyer. POST { heldOn, place, items, notes } */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customerId = Number((await params).id);
  if (!Number.isSafeInteger(customerId) || customerId < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const parsed = discussionFromBody(await request.json().catch(() => null));
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('customer_discussions')
    .insert({ customer_id: customerId, ...parsed.values }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
