import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { watermarkOverlay } from '@/lib/watermark-render';

export const runtime = 'nodejs';

const PREVIEW_WIDTH = 720;

/**
 * The watermark drawn on a real photo, at the settings currently on screen
 * and before anything is saved -- so "how will this look" is answered by the
 * picture rather than by a number in a slider.
 *
 * It composites through the same watermarkOverlay() the real apply uses, at a
 * smaller size. The sample is whichever photo the caller names, falling back
 * to a recent catalogue photo, so the preview is a stone on a real backdrop.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const text = params.get('text') || '';
  const color = params.get('color') || '#ffffff';
  const opacity = Number(params.get('opacity')) || 0.5;
  const photoId = Number(params.get('photo_id'));

  try {
    const query = supabaseAdmin.from('photos').select('storage_path, photo_crop').not('storage_path', 'is', null);
    const { data: photo } = Number.isSafeInteger(photoId) && photoId > 0
      ? await query.eq('id', photoId).maybeSingle()
      : await query.order('id', { ascending: false }).limit(1).maybeSingle();

    const path = photo?.photo_crop?.path || photo?.storage_path;
    // With no catalogue photo to borrow, a plain card still shows the text,
    // the colour and the transparency -- which is most of the question.
    const base = path
      ? await supabaseAdmin.storage.from(PHOTOS_BUCKET).download(path).then((r) => (r.data ? r.data.arrayBuffer().then(Buffer.from) : null))
      : null;

    const source = base
      ? sharp(base, { limitInputPixels: 40000000 }).rotate().resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      : sharp({ create: { width: PREVIEW_WIDTH, height: Math.round(PREVIEW_WIDTH * 0.75), channels: 3, background: '#5d5445' } });

    const flat = await source.jpeg({ quality: 88 }).toBuffer();
    const { width = PREVIEW_WIDTH } = await sharp(flat).metadata();
    const overlay = await watermarkOverlay({ text, color, opacity }, null, width);
    const out = await sharp(flat).composite([{ input: overlay, gravity: 'center' }]).jpeg({ quality: 88 }).toBuffer();

    return new NextResponse(new Uint8Array(out), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Preview unavailable.' }, { status: 400 });
  }
}

