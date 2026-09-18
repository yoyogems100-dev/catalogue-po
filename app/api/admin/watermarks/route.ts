import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('watermarks').select('*').order('sort_order').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const watermarks = (data || []).map((w) => ({
    id: w.id,
    name: w.name,
    opacity: Number(w.opacity),
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${w.storage_path}`
  }));
  return NextResponse.json({ watermarks });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = String(formData.get('name') || '').trim();
  const opacity = Math.min(1, Math.max(0.05, Number(formData.get('opacity')) || 0.5));

  if (!file || !name) return NextResponse.json({ error: 'A name and an image are required.' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `watermarks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(path, arrayBuffer, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('watermarks').insert({ name, storage_path: path, opacity }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
