import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pixelCrop, type SavedCrop } from '@/lib/photo-crop';
import { withWatermark } from '@/lib/watermark-render';

/*
 * Every /po photo is shown watermarked. What the pages show -- storage_path
 * and the two saved crops -- lives in the public `photos` bucket and always
 * carries the YOYO GEMS mark. The file as uploaded is kept, untouched, in the
 * private `originals` bucket (photos.original_path), and every watermarked
 * file is built from it, so re-cropping never stacks a second mark on top.
 *
 * Where the clean original is, by photo:
 *   original_path set  -> the private originals bucket (uploads since watermarking)
 *   drive_id set       -> Google Drive (Drive imports; storage_path is then the
 *                         watermarked copy of it)
 *   otherwise          -> storage_path, a photo uploaded before watermarking
 *                         existed and not yet converted by the backfill
 */

export const ORIGINALS_BUCKET = 'originals';
// Same value as lib/supabase-admin's; not imported from there, because that
// module builds a client on import and scripts and tests use this one alone.
const PHOTOS_BUCKET = 'photos';
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SIDE = 2400;

export type PhotoFiles = {
  id: number;
  category_id: number | null;
  storage_path: string | null;
  original_path?: string | null;
  drive_id: string | null;
  photo_crop?: SavedCrop | null;
  cover_crop?: SavedCrop | null;
};

/** True once everything this photo shows is a watermarked copy. */
export function isWatermarked(photo: PhotoFiles): boolean {
  return Boolean(photo.original_path || (photo.drive_id && photo.storage_path));
}

async function download(db: SupabaseClient, bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await db.storage.from(bucket).download(path);
  if (error || !data) throw new Error('Original image could not be loaded.');
  if (data.size > MAX_BYTES) throw new Error('Use an original smaller than 20 MB.');
  return Buffer.from(await data.arrayBuffer());
}

export async function fetchDriveImage(driveId: string): Promise<Buffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(driveId)) throw new Error('Invalid Drive file.');
  const response = await fetch(`https://lh3.googleusercontent.com/d/${driveId}=w${MAX_SIDE}`, { signal: AbortSignal.timeout(20000), redirect: 'follow', cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error('Drive image unavailable. Check sharing or upload the image directly.');
  const chunks: Uint8Array[] = []; let total = 0; const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) throw new Error('Use an original smaller than 20 MB.');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks);
}

/** The clean, unwatermarked original as uploaded (not yet rotated). */
export async function loadOriginalBytes(db: SupabaseClient, photo: PhotoFiles): Promise<Buffer> {
  if (photo.original_path) return download(db, ORIGINALS_BUCKET, photo.original_path);
  if (photo.drive_id) return fetchDriveImage(photo.drive_id);
  if (photo.storage_path) return download(db, PHOTOS_BUCKET, photo.storage_path);
  throw new Error('No original image is available.');
}

/** The original turned upright, as raw-quality PNG, with its size. */
export async function uprightOriginal(bytes: Buffer) {
  return sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().png().toBuffer({ resolveWithObject: true });
}

/**
 * What a photo variant shows, watermarked, as WebP: the whole original, or the
 * saved crop of it. `upright` comes from uprightOriginal().
 */
export async function watermarkedVariant(upright: { data: Buffer; info: { width: number; height: number } }, crop?: SavedCrop | null): Promise<Buffer> {
  let image = upright.data;
  if (crop) image = await sharp(image).extract(pixelCrop(upright.info.width, upright.info.height, crop)).png().toBuffer();
  image = await sharp(image).resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  return (await withWatermark(image)).webp({ quality: 90 }).toBuffer();
}

function folderOf(photo: Pick<PhotoFiles, 'category_id'>) {
  return photo.category_id === null ? 'unassigned' : String(photo.category_id);
}

/**
 * Stores one watermarked file for a photo and returns its path. The main file
 * is named without the photo id, because a fresh upload stores it before the
 * row (and so the id) exists.
 */
export async function uploadWatermarked(db: SupabaseClient, photo: Pick<PhotoFiles, 'category_id'> & { id?: number }, bytes: Buffer, kind: 'photo' | 'crop-photo' | 'crop-cover'): Promise<string> {
  const path = kind === 'photo'
    ? `${folderOf(photo)}/wm-${randomUUID()}.webp`
    : `${folderOf(photo)}/crops/${photo.id}-${kind === 'crop-cover' ? 'cover' : 'photo'}-${randomUUID()}.webp`;
  const { error } = await db.storage.from(PHOTOS_BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false });
  if (error) throw new Error('Could not save the watermarked image. Please retry.');
  return path;
}

/**
 * Rebuilds every file a photo shows -- the photo and both saved crops -- as
 * watermarked copies of its clean original, and keeps that original in the
 * private bucket. Returns the row update to save and the files it replaces
 * (still referenced until the update is saved, so the caller removes them
 * only afterwards -- or never, while cached pages may still point at them).
 * Nothing is written to the row here.
 */
export async function rebuildWatermarkedFiles(db: SupabaseClient, photo: PhotoFiles) {
  const bytes = await loadOriginalBytes(db, photo);
  const upright = await uprightOriginal(bytes);
  const created: string[] = [];
  try {
    const update: Record<string, unknown> = {};
    const replaced: string[] = [];

    // A photo uploaded before watermarking: its storage_path IS the original.
    // Copy it into the private bucket before storage_path moves off it.
    if (!photo.original_path && !photo.drive_id && photo.storage_path) {
      const { error } = await db.storage.from(ORIGINALS_BUCKET).upload(photo.storage_path, bytes, { upsert: true, contentType: contentTypeOf(photo.storage_path) });
      if (error) throw new Error(`Could not keep the original (${error.message}).`);
      update.original_path = photo.storage_path;
    }

    const main = await uploadWatermarked(db, photo, await watermarkedVariant(upright), 'photo');
    created.push(main);
    update.storage_path = main;
    if (photo.storage_path) replaced.push(photo.storage_path);

    for (const [column, kind] of [['photo_crop', 'crop-photo'], ['cover_crop', 'crop-cover']] as const) {
      const crop = photo[column];
      if (!crop) continue;
      const path = await uploadWatermarked(db, photo, await watermarkedVariant(upright, crop), kind);
      created.push(path);
      update[column] = { ...crop, path };
      if (crop.path) replaced.push(crop.path);
    }
    return { update, replaced, created };
  } catch (e) {
    if (created.length) await db.storage.from(PHOTOS_BUCKET).remove(created);
    throw e;
  }
}

export function contentTypeOf(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'heic' || ext === 'heif' ? 'image/heic' : ext === 'avif' ? 'image/avif' : 'image/jpeg';
}
