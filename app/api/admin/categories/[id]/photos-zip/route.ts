import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

// Zips every photo in a category (cover included) at full quality, named
// after the category, for a one-click bulk download from the admin.
export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = await paramsPromise;
  const categoryId = Number(params.id);

  const { data: category } = await supabaseAdmin.from('categories').select('id, name, slug').eq('id', categoryId).single();
  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const { data: photos } = await supabaseAdmin
    .from('photos')
    .select('id, storage_path, drive_id, photo_crop, cover_crop, product_code')
    .eq('category_id', categoryId)
    .order('sort_order');
  if (!photos || photos.length === 0) return NextResponse.json({ error: 'This category has no photos' }, { status: 404 });

  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);
  archive.on('warning', (err) => console.error('zip warning', err));
  archive.on('error', (err) => stream.destroy(err));

  const usedNames = new Set<string>();
  function uniqueName(base: string, ext: string) {
    let name = `${base}.${ext}`;
    let n = 2;
    while (usedNames.has(name)) { name = `${base}-${n}.${ext}`; n++; }
    usedNames.add(name);
    return name;
  }

  (async () => {
    for (const photo of photos) {
      const url = photoUrl(photo, 2000, 'photo');
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (!res.ok || !res.body) continue;
        const buffer = Buffer.from(await res.arrayBuffer());
        const ext = (url.split('.').pop() || 'jpg').split('?')[0].slice(0, 5);
        const name = uniqueName(photo.product_code || `photo-${photo.id}`, ext);
        archive.append(buffer, { name });
      } catch {
        // One photo failing to fetch shouldn't abort the whole archive.
      }
    }
    archive.finalize();
  })();

  return new NextResponse(Readable.toWeb(stream) as any, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${category.slug || category.name}.zip"`
    }
  });
}
