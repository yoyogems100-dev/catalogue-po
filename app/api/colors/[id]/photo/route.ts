import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const colorId = Number(params.id);
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const ext = file.name.split('.').pop() || 'jpg';
  const path = `color-refs/${colorId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const refPhotoUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${path}`;

  const { data, error: dbError } = await supabaseAdmin
    .from('colors')
    .update({ ref_photo_url: `${refPhotoUrl}?v=${Date.now()}` })
    .eq('id', colorId)
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const colorId = Number(params.id);
  const { error } = await supabaseAdmin.from('colors').update({ ref_photo_url: null }).eq('id', colorId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
