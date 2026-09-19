import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';

// Streams a single photo's full-quality file back with a download-forcing
// Content-Disposition header -- a plain <a download> tag doesn't reliably
// trigger a save for a cross-origin Supabase Storage / Drive URL, only for
// same-origin ones.
export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = await paramsPromise;
  const id = Number(params.id);

  // photos<->categories has two possible joins (category_id, and categories'
  // own thumbnail_photo_id back-reference) -- name the FK explicitly so
  // PostgREST doesn't refuse the embed as ambiguous.
  const { data: photo } = await supabaseAdmin
    .from('photos')
    .select('id, storage_path, drive_id, photo_crop, cover_crop, product_code, category_id, categories!photos_category_id_fkey(name, slug)')
    .eq('id', id)
    .single();
  if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

  const url = photoUrl(photo, 2000, 'photo');
  if (!url) return NextResponse.json({ error: 'No image on file for this photo' }, { status: 404 });

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return NextResponse.json({ error: 'Could not fetch the image' }, { status: 502 });

  const categoryName = (photo as any).categories?.slug || `category-${photo.category_id}`;
  const ext = (url.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
  const filename = `${categoryName}-${photo.product_code || photo.id}.${ext}`;

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  });
}
