import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { DISCUSSION_PHOTO_UPLOAD_LIMIT, discussionPhotoPath, discussionPhotoUrl } from '@/lib/discussions';

export const runtime = 'nodejs';

/** Upload one photo for a discussion item (form field "file"). Returns its
 *  storage path; the photo joins the item when the discussion is saved. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const customerId = Number((await params).id);
  if (!Number.isSafeInteger(customerId) || customerId < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: 'Choose a photo.' }, { status: 400 });
  if (file.size > DISCUSSION_PHOTO_UPLOAD_LIMIT + 400_000) return NextResponse.json({ error: `${file.name}: too large -- use a JPG under 4 MB.` }, { status: 400 });
  let bytes: Buffer;
  try {
    const source = Buffer.from(await file.arrayBuffer());
    const meta = await sharp(source, { limitInputPixels: 40_000_000 }).metadata();
    if (!['jpeg', 'png', 'webp', 'heif'].includes(meta.format || '')) return NextResponse.json({ error: `${file.name}: use a JPG, PNG or WebP photo.` }, { status: 400 });
    bytes = await sharp(source, { limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86 }).toBuffer();
  } catch {
    return NextResponse.json({ error: `${file.name}: could not read this photo -- try a JPG.` }, { status: 400 });
  }
  const path = discussionPhotoPath(customerId, randomUUID());
  const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
  if (error) return NextResponse.json({ error: 'Could not upload the photo. Please try again.' }, { status: 500 });
  return NextResponse.json({ path, url: discussionPhotoUrl(path) });
}
