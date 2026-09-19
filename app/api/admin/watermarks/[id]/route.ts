import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const { name, opacity } = await req.json();
  const patch: Record<string, any> = {};
  if (typeof name === 'string' && name.trim()) patch.name = name.trim();
  if (typeof opacity === 'number' && Number.isFinite(opacity)) patch.opacity = Math.min(1, Math.max(0.05, opacity));
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  const { error } = await supabaseAdmin.from('watermarks').update(patch).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Deleting a preset never touches photos that already have it baked into
// their watermarked_path -- they keep looking exactly as they do now, they
// just lose the reference (watermark_id set null by the database's own
// ON DELETE SET NULL) tracking which preset produced it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  const { data: watermark } = await supabaseAdmin.from('watermarks').select('storage_path').eq('id', id).single();
  if (watermark?.storage_path) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([watermark.storage_path]);
  const { error } = await supabaseAdmin.from('watermarks').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
