import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { watermarkOverlay } from '@/lib/watermark-render';

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

export async function POST(req: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let uploaded: string | undefined;
  try {
    const { watermark_id } = await req.json();
    if (!Number.isSafeInteger(watermark_id)) return NextResponse.json({ error: 'watermark_id required' }, { status: 400 });

    const photo = await getPhoto(context);
    const { data: watermark, error: wmError } = await supabaseAdmin.from('watermarks').select('*').eq('id', watermark_id).single();
    if (wmError || !watermark) return NextResponse.json({ error: 'Watermark preset not found.' }, { status: 404 });

    // A typed watermark has no file to fetch; an uploaded one still does.
    const [sourceBuffer, watermarkBuffer] = await Promise.all([
      currentPhotoSource(photo),
      watermark.storage_path
        ? supabaseAdmin.storage.from(PHOTOS_BUCKET).download(watermark.storage_path).then((r) => {
            if (r.error || !r.data) throw new Error('Watermark image could not be loaded.');
            return r.data.arrayBuffer().then(Buffer.from);
          })
        : Promise.resolve(null)
    ]);

    const source = sharp(sourceBuffer, { limitInputPixels: 40000000 }).rotate();
    const { width: sourceWidth = 800 } = await source.metadata();

    // Sized relative to the photo and centered -- a fixed pixel size would
    // look tiny on a large photo and oversized on a small one. The preview in
    // the watermark editor goes through this same function.
    const overlay = await watermarkOverlay(watermark, watermarkBuffer, sourceWidth);

    const output = await source
      .composite([{ input: overlay, gravity: 'center' }])
      .webp({ quality: 90 })
      .toBuffer();

    uploaded = `${photo.category_id}/watermarked/${photo.id}-${randomUUID()}.webp`;
    const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(uploaded, output, { contentType: 'image/webp', upsert: false });
    if (uploadError) throw new Error('Could not save the watermarked image. Please retry.');

    const previous = photo.watermarked_path;
    const { error: saveError } = await supabaseAdmin.from('photos').update({ watermark_id, watermarked_path: uploaded }).eq('id', photo.id);
    if (saveError) throw new Error('Could not save the watermark. The photo is unchanged.');

    uploaded = undefined;
    // Only once the new one is safely on record. Re-watermarking used to
    // leave the old rendering in storage for good, which across a whole
    // gallery adds up to a copy of it per pass.
    if (previous) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([previous]);
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
    // The rendering is disposable -- it can be rebuilt from the original at
    // any time -- and nothing points at it once the row is cleared.
    if (photo.watermarked_path) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove([photo.watermarked_path]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Could not remove the watermark. Please retry.' }, { status: 400 });
  }
}
