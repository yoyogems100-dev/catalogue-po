import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

export const runtime = 'nodejs';
const MAX_BYTES = 20 * 1024 * 1024;

type Context = { params: Promise<{ id: string }> };

async function getPhoto(context: Context) {
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid photo.');
  const { data, error } = await supabaseAdmin.from('photos').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Photo could not be loaded.');
  return data;
}

// The CURRENT "photo" variant -- the crop already chosen for this photo, if
// any, not always the raw original -- so the watermark lines up with what's
// actually shown, not a since-cropped-away region.
async function currentPhotoSource(photo: any): Promise<Buffer> {
  const path = photo.photo_crop?.path || photo.storage_path;
  if (path) {
    const { data, error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).download(path);
    if (error || !data) throw new Error('Source image could not be loaded.');
    if (data.size > MAX_BYTES) throw new Error('Use an original smaller than 20 MB.');
    return Buffer.from(await data.arrayBuffer());
  }
  if (typeof photo.drive_id === 'string' && /^[A-Za-z0-9_-]+$/.test(photo.drive_id)) {
    const response = await fetch(`https://lh3.googleusercontent.com/d/${photo.drive_id}=w2400`, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error('Drive image unavailable.');
    const chunks: Uint8Array[] = []; let total = 0; const reader = response.body.getReader();
    try { while (true) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > MAX_BYTES) throw new Error('Use an original smaller than 20 MB.'); chunks.push(value); } } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
  }
  throw new Error('No source image is available.');
}

// Scales an already-transparent PNG's alpha channel by `opacity` (0-1) --
// sharp's composite() has no opacity option of its own, and ensureAlpha()
// only fills in a MISSING alpha channel, it doesn't scale an existing one.
async function withOpacity(buffer: Buffer, opacity: number): Promise<Buffer> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * opacity);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

export async function POST(req: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let uploaded: string | undefined;
  try {
    const { watermark_id } = await req.json();
    if (!Number.isSafeInteger(watermark_id)) return NextResponse.json({ error: 'watermark_id required' }, { status: 400 });

    const photo = await getPhoto(context);
    const { data: watermark, error: wmError } = await supabaseAdmin.from('watermarks').select('*').eq('id', watermark_id).single();
    if (wmError || !watermark) return NextResponse.json({ error: 'Watermark preset not found.' }, { status: 404 });

    const [sourceBuffer, watermarkFile] = await Promise.all([
      currentPhotoSource(photo),
      supabaseAdmin.storage.from(PHOTOS_BUCKET).download(watermark.storage_path)
    ]);
    if (watermarkFile.error || !watermarkFile.data) throw new Error('Watermark image could not be loaded.');
    const watermarkBuffer = Buffer.from(await watermarkFile.data.arrayBuffer());

    const source = sharp(sourceBuffer, { limitInputPixels: 40000000 }).rotate();
    const { width: sourceWidth = 800, height: sourceHeight = 800 } = await source.metadata();

    // Sized relative to the photo (40% of its width) and centered -- a fixed
    // pixel size would look tiny on a large photo and oversized on a small one.
    const targetWidth = Math.max(40, Math.round(sourceWidth * 0.4));
    const resizedWatermark = await sharp(watermarkBuffer).resize({ width: targetWidth, withoutEnlargement: false }).toBuffer();
    const opacityWatermark = await withOpacity(resizedWatermark, Number(watermark.opacity) || 0.5);

    const output = await source
      .composite([{ input: opacityWatermark, gravity: 'center' }])
      .webp({ quality: 90 })
      .toBuffer();

    uploaded = `${photo.category_id}/watermarked/${photo.id}-${randomUUID()}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(uploaded, output, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw new Error('Could not save the watermarked image. Please retry.');

    const { error: saveError } = await supabaseAdmin.from('photos').update({ watermark_id, watermarked_path: uploaded }).eq('id', photo.id);
    if (saveError) throw new Error('Could not save the watermark. The photo is unchanged.');

    uploaded = undefined;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (uploaded) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([uploaded]);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not apply the watermark. Please retry.' }, { status: 400 });
  }
}

// Removes the watermark -- the original file (and any existing crop) was
// never touched, so this is a clean, complete revert.
export async function DELETE(req: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const photo = await getPhoto(context);
    const { error } = await supabaseAdmin.from('photos').update({ watermark_id: null, watermarked_path: null }).eq('id', photo.id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove the watermark. Please retry.' }, { status: 400 });
  }
}
