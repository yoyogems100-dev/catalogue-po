export function photoUrl(photo: { storage_path?: string | null; drive_id?: string | null }, size = 400): string | null {
  if (photo.storage_path) {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${photo.storage_path}`;
  }
  if (photo.drive_id) {
    return `https://lh3.googleusercontent.com/d/${photo.drive_id}=w${size}`;
  }
  return null;
}
