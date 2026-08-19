import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Body: { id: number } for one, or { all: true } to clear everything.
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, all } = await req.json();

  if (all) {
    await supabaseAdmin.from('notifications').update({ is_read: true }).eq('is_read', false);
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: 'id or all required' }, { status: 400 });
  await supabaseAdmin.from('notifications').update({ is_read: true }).eq('id', id);
  return NextResponse.json({ ok: true });
}
