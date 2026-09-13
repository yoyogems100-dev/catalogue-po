import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { PHOTOS_BUCKET, supabaseAdmin } from '@/lib/supabase-admin';

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number((await params).id);
  const form = await request.formData();
  const shapeId = Number(form.get('shape_id'));
  const file = form.get('file');
  if (!Number.isInteger(categoryId) || !Number.isInteger(shapeId) || !(file instanceof File)) {
    return NextResponse.json({ error: 'Category, shape and image are required.' }, { status: 400 });
  }
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type) || file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Use a PNG, WebP or JPEG image smaller than 8 MB.' }, { status: 400 });
  }

  try {
    const { data: link, error: linkError } = await supabaseAdmin
      .from('category_shapes')
      .select('shape_id')
      .eq('category_id', categoryId)
      .eq('shape_id', shapeId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) return NextResponse.json({ error: 'This shape is not linked to the category.' }, { status: 404 });

    const source = Buffer.from(await file.arrayBuffer());
    const bytes = await sharp(source, { limitInputPixels: 30_000_000 })
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 94, alphaQuality: 100 })
      .toBuffer();
    const storagePath = `shape-references/${categoryId}/${shapeId}-${Date.now()}.webp`;
    const uploaded = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(storagePath, bytes, { contentType: 'image/webp', upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);
    const updated = await supabaseAdmin.from('category_shapes').update({ ref_photo_url: data.publicUrl, reference_style: 'photo' }).eq('category_id', categoryId).eq('shape_id', shapeId);
    if (updated.error) throw updated.error;
    return NextResponse.json({ refPhotoUrl: data.publicUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not prepare the image.' }, { status: 400 });
  }
}
