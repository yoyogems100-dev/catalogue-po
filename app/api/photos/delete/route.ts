import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { ORIGINALS_BUCKET } from '@/lib/photo-files';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { data: photo } = await supabaseAdmin.from('photos').select('storage_path, original_path').eq('id', id).single();

  if (photo?.storage_path) {
    await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
  }
  // The untouched upload the watermarked copy was made from.
  if (photo?.original_path) {
    await supabaseAdmin.storage.from(ORIGINALS_BUCKET).remove([photo.original_path]);
  }

  const { error } = await supabaseAdmin.from('photos').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
