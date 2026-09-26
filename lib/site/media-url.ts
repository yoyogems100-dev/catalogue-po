// Client-safe helpers for building image URLs and srcsets from site_media rows.

export const VARIANT_WIDTHS = [480, 960, 1600] as const;

export type MediaRow = {
  id: number;
  storage_path: string;
  variants: Record<string, string> | null;
  width: number | null;
  height: number | null;
  alt: string;
  tags?: string[];
};

export function mediaUrl(path: string): string {
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
}

/** The smallest stored copy at least `width` wide (or the original). */
export function mediaSrc(media: Pick<MediaRow, 'storage_path' | 'variants'>, width = 960): string {
  const widths = Object.keys(media.variants || {}).map(Number).sort((a, b) => a - b);
  const pick = widths.find((w) => w >= width);
  return mediaUrl(pick ? media.variants![String(pick)] : media.storage_path);
}

export function mediaSrcSet(media: Pick<MediaRow, 'storage_path' | 'variants' | 'width'>): string {
  const parts = Object.entries(media.variants || {}).map(([w, p]) => `${mediaUrl(p)} ${w}w`);
  if (media.width) parts.push(`${mediaUrl(media.storage_path)} ${media.width}w`);
  return parts.join(', ');
}
