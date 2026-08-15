import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import CategoryAdminClient from './CategoryAdminClient';
import Link from 'next/link';

export default async function CategoryAdminPage({ params }: { params: { id: string } }) {
  const categoryId = Number(params.id);

  const [
    { data: category },
    { data: allShapes },
    { data: allColors },
    { data: allTags },
    { data: allSizes },
    { data: linkedShapes },
    { data: linkedColors },
    { data: linkedTags },
    { data: linkedSizes },
    { data: photos }
  ] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id').eq('id', categoryId).single(),
    supabaseAdmin.from('shapes').select('id, name, icon_key').order('name'),
    supabaseAdmin.from('colors').select('id, name, hex_value').order('name'),
    supabaseAdmin.from('tags').select('id, name, is_global').order('name'),
    supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, weight_ct'),
    supabaseAdmin.from('category_shapes').select('shape_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_tags').select('tag_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId),
    supabaseAdmin
      .from('photos')
      .select('id, storage_path, drive_id, shape_id, shape_size_id, color_id, product_code, notes, photo_tags(tag_id)')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true })
  ]);

  if (!category) {
    return <p>Category not found. <Link href="/admin/categories">&larr; Back</Link></p>;
  }

  const photosFormatted = (photos || []).map((p: any) => ({
    id: p.id,
    url: photoUrl(p, 400),
    shape_id: p.shape_id,
    shape_size_id: p.shape_size_id,
    color_id: p.color_id,
    product_code: p.product_code,
    notes: p.notes,
    tag_ids: (p.photo_tags || []).map((t: any) => t.tag_id)
  }));

  return (
    <>
      <Link href="/admin/categories" style={{ fontSize: 13, color: 'var(--navy)' }}>&larr; All categories</Link>
      <h1 style={{ marginTop: 8 }}>{String(category.num).padStart(2, '0')} — {category.name}</h1>
      <CategoryAdminClient
        categoryId={categoryId}
        allShapes={(allShapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }))}
        allColors={(allColors || []).map((c: any) => ({ id: c.id, name: c.name, hexValue: c.hex_value }))}
        allTags={allTags || []}
        allSizes={allSizes || []}
        linkedShapeIds={(linkedShapes || []).map((r: any) => r.shape_id)}
        linkedColorIds={(linkedColors || []).map((r: any) => r.color_id)}
        linkedTagIds={(linkedTags || []).map((r: any) => r.tag_id)}
        linkedSizeIds={(linkedSizes || []).map((r: any) => r.shape_size_id)}
        thumbnailPhotoId={category.thumbnail_photo_id}
        photos={photosFormatted}
      />
    </>
  );
}
