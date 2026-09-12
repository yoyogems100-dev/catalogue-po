import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };
export async function POST(request: NextRequest, context: Context) {
  if (!await isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let uploaded: string | undefined;
  try {
    const id = Number((await context.params).id);
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    const { data: category, error } = await supabaseAdmin.from('categories').select('id, slug, color_chart_url').eq('id', id).single();
    if (error || !category) return NextResponse.json({ error: 'Category or color-chart setup unavailable.' }, { status: 400 });
    const form = await request.formData();
    let url: string | null = null;
    if (form.get('remove') !== 'true') {
      const file = form.get('file');
      if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024) return NextResponse.json({ error: 'Choose a JPG, PNG or WebP image smaller than 3 MB.' }, { status: 400 });
      const source = Buffer.from(await file.arrayBuffer());
      const metadata = await sharp(source, { limitInputPixels: 40000000 }).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1) return NextResponse.json({ error: 'Use a still JPG, PNG or WebP image.' }, { status: 400 });
      const bytes = await sharp(source, { limitInputPixels: 40000000 }).rotate().resize({ width: 4000, height: 4000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 95 }).toBuffer();
      uploaded = `${id}/color-charts/${randomUUID()}.webp`;
      const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(uploaded, bytes, { contentType: 'image/webp', upsert: false });
      if (uploadError) throw uploadError;
      url = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(uploaded).data.publicUrl;
    }
    const { error: saveError, data } = await supabaseAdmin.from('categories').update({ color_chart_url: url }).eq('id', id).select('id').single();
    if (saveError || !data) throw saveError || new Error('Save failed');
    // Retain previous files for cached pages; replacement never destroys the old chart.
    uploaded = undefined;
    revalidatePath(`/category/${category.slug}`);
    revalidatePath(`/admin/categories/${id}`);
    return NextResponse.json({ url });
  } catch {
    if (uploaded) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([uploaded]);
    return NextResponse.json({ error: 'Could not save the chart. The previous chart has been kept. Please try again.' }, { status: 400 });
  }
}
