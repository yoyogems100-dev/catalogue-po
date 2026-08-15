import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const category_id = formData.get('category_id') as string;

  if (!file || !category_id) {
    return NextResponse.json({ error: 'file and category_id required' }, { status: 400 });
  }

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${category_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: photo, error: dbError } = await supabaseAdmin
    .from('photos')
    .insert({ category_id: Number(category_id), storage_path: path })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json(photo);
}
