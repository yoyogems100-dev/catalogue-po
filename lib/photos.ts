import type { SavedCrop } from './photo-crop';
export function photoUrl(photo: { storage_path?: string | null; drive_id?: string | null; photo_crop?: SavedCrop | null; cover_crop?: SavedCrop | null; watermarked_path?: string | null }, size = 400, use: 'photo' | 'cover' = 'photo'): string | null {
  // A watermark applies to the "photo" variant only (the catalogue/Explore
  // Photos image) -- it wins over an unwatermarked crop, but never touches
  // the original file or the separate cover-photo crop.
  const path = (use === 'cover' ? photo.cover_crop?.path : null) || (use === 'photo' ? photo.watermarked_path : null) || photo.photo_crop?.path || photo.storage_path;
  if (path) return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
  if (photo.drive_id) return `https://lh3.googleusercontent.com/d/${photo.drive_id}=w${size}`;
  return null;
}
