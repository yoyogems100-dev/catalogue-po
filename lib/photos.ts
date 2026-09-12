import type { SavedCrop } from './photo-crop';
export function photoUrl(photo: { storage_path?: string | null; drive_id?: string | null; photo_crop?: SavedCrop | null; cover_crop?: SavedCrop | null }, size = 400, use: 'photo' | 'cover' = 'photo'): string | null {
  const path = (use === 'cover' ? photo.cover_crop?.path : null) || photo.photo_crop?.path || photo.storage_path;
  if (path) return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${path}`;
  if (photo.drive_id) return `https://lh3.googleusercontent.com/d/${photo.drive_id}=w${size}`;
  return null;
}
