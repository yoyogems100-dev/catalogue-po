import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';
import { mediaUrl, VARIANT_WIDTHS } from './media-url';

// Website images are stored once as a high-quality WebP "original" plus a few
// smaller WebP widths, all generated here at upload. The public pages pick a
// width with srcset, so a phone on mobile data never downloads the 2400px copy.

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ORIGINAL = 2400;

export type ProcessedMedia = { storage_path: string; variants: Record<string, string>; width: number; height: number };

export async function storeSiteImage(file: File): Promise<ProcessedMedia | { error: string }> {
  if (!file.size || file.size > MAX_BYTES) return { error: `${file.name}: choose an image under 15 MB.` };
  const source = Buffer.from(await file.arrayBuffer());
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    meta = await sharp(source, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    return { error: `${file.name}: this file is not an image we can read.` };
  }
  if (!['jpeg', 'png', 'webp', 'avif', 'tiff', 'heif'].includes(meta.format || '') || (meta.pages || 1) > 1) {
    return { error: `${file.name}: use a JPG, PNG, WebP, AVIF, HEIC or TIFF photo.` };
  }
  const base = `site/${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  const pipeline = () => sharp(source, { limitInputPixels: 60_000_000 }).rotate();
  const original = await pipeline().resize({ width: MAX_ORIGINAL, height: MAX_ORIGINAL, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88 }).toBuffer({ resolveWithObject: true });

  const uploads: [string, Buffer][] = [[`${base}.webp`, original.data]];
  const variants: Record<string, string> = {};
  for (const w of VARIANT_WIDTHS) {
    if (w >= original.info.width) continue;
    const buf = await pipeline().resize({ width: w, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    const path = `${base}-${w}.webp`;
    uploads.push([path, buf]);
    variants[String(w)] = path;
  }
  const done: string[] = [];
  for (const [path, bytes] of uploads) {
    const { error } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(path, bytes, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (error) {
      if (done.length) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove(done);
      return { error: `${file.name}: upload failed (${error.message}).` };
    }
    done.push(path);
  }
  return { storage_path: `${base}.webp`, variants, width: original.info.width, height: original.info.height };
}

export async function removeStoredFiles(media: { storage_path: string; variants: Record<string, string> | null }) {
  const paths = [media.storage_path, ...Object.values(media.variants || {})].filter((p) => p.startsWith('site/'));
  if (paths.length) await supabaseAdmin.storage.from(PHOTOS_BUCKET).remove(paths);
}

export { mediaUrl };
