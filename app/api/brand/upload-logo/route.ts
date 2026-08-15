import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import sharp from 'sharp';

// Uploads the brand logo to fixed paths in the same Storage bucket product
// photos use. Kept separate from /api/photos/upload since this isn't tied to
// any category -- it's a fixed site-wide asset, always overwritten in place.
//
// Whatever the person uploads (even a flat white/light background, no
// transparency) gets auto-processed into two versions:
//  - yoyo-logo-horizontal.png       transparent background, original colors
//  - yoyo-logo-horizontal-white.png transparent background, all-white --
//    used in the header, which sits on the dark navy topbar
//
// Background removal is a simple near-white color-key: any pixel close to
// white is treated as background and made transparent. Works well for
// logo artwork on a flat light background; won't handle photographic
// backgrounds, but that's not what a logo upload is.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  const { data, info } = await sharp(inputBuffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  const whiteData = Buffer.from(data);
  const WHITE_THRESHOLD = 235;

  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const isBackground = r > WHITE_THRESHOLD && g > WHITE_THRESHOLD && b > WHITE_THRESHOLD;
    if (isBackground) {
      data[i + 3] = 0;
      whiteData[i + 3] = 0;
    } else {
      whiteData[i] = 255;
      whiteData[i + 1] = 255;
      whiteData[i + 2] = 255;
    }
  }

  const [cutoutPng, whitePng] = await Promise.all([
    sharp(data, { raw: { width, height, channels } }).png().toBuffer(),
    sharp(whiteData, { raw: { width, height, channels } }).png().toBuffer()
  ]);

  const [cutoutUpload, whiteUpload] = await Promise.all([
    supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload('brand/yoyo-logo-horizontal.png', cutoutPng, { contentType: 'image/png', upsert: true }),
    supabaseAdmin.storage
      .from(PHOTOS_BUCKET)
      .upload('brand/yoyo-logo-horizontal-white.png', whitePng, { contentType: 'image/png', upsert: true })
  ]);

  if (cutoutUpload.error) return NextResponse.json({ error: cutoutUpload.error.message }, { status: 400 });
  if (whiteUpload.error) return NextResponse.json({ error: whiteUpload.error.message }, { status: 400 });

  return NextResponse.json({
    ok: true,
    paths: ['brand/yoyo-logo-horizontal.png', 'brand/yoyo-logo-horizontal-white.png']
  });
}
