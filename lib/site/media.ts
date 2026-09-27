import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { ORIGINALS_BUCKET } from '@/lib/photo-files';
import { withWatermark } from '@/lib/watermark-render';
import { mediaUrl, VARIANT_WIDTHS } from './media-url';

// Website images are stored once as a high-quality WebP "original" plus a few
// smaller WebP widths, all generated here at upload. The public pages pick a
// width with srcset, so a phone on mobile data never downloads the 2400px copy.
//
// Every copy the pages show carries the YOYO GEMS watermark. The clean image
// is kept, at the same path, in the private originals bucket (original_path),
// so the set can be rebuilt without ever marking a marked picture again.

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ORIGINAL = 2400;

export type ProcessedMedia = { storage_path: string; original_path: string; variants: Record<string, string>; width: number; height: number };

export async function storeSiteImage(file: File): Promise<ProcessedMedia | { error: string }> {
  if (!file.size || file.size > MAX_BYTES) return { error: `${file.name}: choose an image under 15 MB.` };
  return storeImageBytes(supabaseAdmin, Buffer.from(await file.arrayBuffer()), file.name);
}

/** Convert and upload image bytes with any service-role client (the app's, or a script's). */
export async function storeImageBytes(db: SupabaseClient, source: Buffer, name: string): Promise<ProcessedMedia | { error: string }> {
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(source, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    return { error: `${name}: this file is not an image we can read.` };
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'tiff', 'heif'].includes(meta.format || '') || (meta.pages || 1) > 1) {
    return { error: `${name}: use a JPG, PNG, WebP, AVIF, HEIC or TIFF photo.` };
  }
  const base = `site/${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  const upright = await sharp(source, { limitInputPixels: 60_000_000 }).rotate()
    .resize({ width: MAX_ORIGINAL, height: MAX_ORIGINAL, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
  const clean = await sharp(upright).webp({ quality: 92 }).toBuffer();
  const { error } = await db.storage.from(ORIGINALS_BUCKET).upload(`${base}.webp`, clean, { contentType: 'image/webp', upsert: false });
  if (error) return { error: `${name}: upload failed (${error.message}).` };
  const stored = await storeWatermarkedSet(db, upright, base, name);
  if ('error' in stored) {
    await db.storage.from(ORIGINALS_BUCKET).remove([`${base}.webp`]);
    return stored;
  }
  return { ...stored, original_path: `${base}.webp` };
}

/** The watermarked WebP set the pages show: `${base}.webp` plus smaller widths. */
async function storeWatermarkedSet(db: SupabaseClient, upright: Buffer, base: string, name: string): Promise<Omit<ProcessedMedia, 'original_path'> | { error: string }> {
  // Marked once at full size, then scaled, so the mark keeps its proportion
  // in every width.
  const marked = await (await withWatermark(upright)).png().toBuffer();
  const original = await sharp(marked).webp({ quality: 88 }).toBuffer({ resolveWithObject: true });

  const uploads: [string, Buffer][] = [[`${base}.webp`, original.data]];
  const variants: Record<string, string> = {};
  for (const w of VARIANT_WIDTHS) {
    if (w >= original.info.width) continue;
    const buf = await sharp(marked).resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const path = `${base}-${w}.webp`;
    uploads.push([path, buf]);
    variants[String(w)] = path;
  }
  const done: string[] = [];
  for (const [path, bytes] of uploads) {
    const { error } = await db.storage.from(PHOTOS_BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) {
      if (done.length) await db.storage.from(PHOTOS_BUCKET).remove(done);
      return { error: `${name}: upload failed (${error.message}).` };
    }
    done.push(path);
  }
  return { storage_path: `${base}.webp`, variants, width: original.info.width, height: original.info.height };
}

/**
 * Watermarks a website image stored before watermarking existed: its current
 * storage_path is the clean picture, so that is kept in the originals bucket
 * and a watermarked set is written under a new name. Returns the row update and
 * the old public files it replaces (removed by the caller once no page can
 * still be pointing at them). Writes nothing to the row.
 */
export async function watermarkStoredMedia(db: SupabaseClient, media: { id: number; storage_path: string; variants: Record<string, string> | null }) {
  const { data, error } = await db.storage.from(PHOTOS_BUCKET).download(media.storage_path);
  if (error || !data) throw new Error(`Media ${media.id}: could not download (${error?.message || 'missing'}).`);
  const clean = Buffer.from(await data.arrayBuffer());
  const kept = await db.storage.from(ORIGINALS_BUCKET).upload(media.storage_path, clean, { contentType: 'image/webp', upsert: true });
  if (kept.error) throw new Error(`Media ${media.id}: could not keep the original (${kept.error.message}).`);
  const upright = await sharp(clean).rotate().png().toBuffer();
  const base = media.storage_path.replace(/\.webp$/, '') + `-wm-${randomUUID().slice(0, 8)}`;
  const stored = await storeWatermarkedSet(db, upright, base, `Media ${media.id}`);
  if ('error' in stored) throw new Error(stored.error);
  return {
    update: { ...stored, original_path: media.storage_path },
    replaced: [media.storage_path, ...Object.values(media.variants || {})],
    created: [stored.storage_path, ...Object.values(stored.variants)]
  };
}

export async function removeStoredFiles(media: { storage_path: string; variants: Record<string, string> | null; original_path?: string | null }, db: SupabaseClient = supabaseAdmin) {
  const paths = [media.storage_path, ...Object.values(media.variants || {})].filter((p) => p.startsWith('site/'));
  if (paths.length) await db.storage.from(PHOTOS_BUCKET).remove(paths);
  if (media.original_path?.startsWith('site/')) await db.storage.from(ORIGINALS_BUCKET).remove([media.original_path]);
}

export { mediaUrl };
