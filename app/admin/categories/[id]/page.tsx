import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import CategoryAdminClient from './CategoryAdminClient';
import Link from 'next/link';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
export const dynamic = 'force-dynamic';

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
    { data: photos },
    { data: colorPalettesRaw },
    { data: colorPaletteItems }
  ] = await Promise.all([
    supabaseAdmin.from('categories').select('id, num, name, slug, thumbnail_photo_id, badge_types').eq('id', categoryId).single(),
    supabaseAdmin.from('shapes').select('id, name, icon_key').order('sort_order').order('name'),
    supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').order('sort_order').order('name'),
    supabaseAdmin.from('tags').select('id, name, is_global').order('name'),
    supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm, weight_ct'),
    supabaseAdmin.from('category_shapes').select('shape_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_tags').select('tag_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId),
    supabaseAdmin
      .from('photos')
      .select(
        'id, storage_path, drive_id, product_code, notes, is_cover_only, photo_tags(tag_id), photo_shapes(shape_id), photo_sizes(shape_size_id), photo_colors(color_id)'
      )
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true }),
    supabaseAdmin.from('color_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('color_palette_items').select('palette_id, color_id')
  ]);

  if (!category) {
    return <p>Category not found. <Link href="/admin/categories">&larr; Back</Link></p>;
  }

  const colorPalettes = (colorPalettesRaw || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    memberIds: (colorPaletteItems || []).filter((i: any) => i.palette_id === p.id).map((i: any) => i.color_id)
  })).filter((p) => p.memberIds.length > 0);

  const photosFormatted = (photos || []).map((p: any) => ({
    id: p.id,
    url: photoUrl(p, 400),
    shapeIds: (p.photo_shapes || []).map((r: any) => r.shape_id),
    sizeIds: (p.photo_sizes || []).map((r: any) => r.shape_size_id),
    colorIds: (p.photo_colors || []).map((r: any) => r.color_id),
    product_code: p.product_code,
    notes: p.notes,
    tag_ids: (p.photo_tags || []).map((t: any) => t.tag_id),
    isCoverOnly: p.is_cover_only
  }));

  return (
    <>
      <Link href="/admin/categories" className="back-link">&larr; All categories</Link>
      <h1 style={{ marginTop: 8 }}>{String(category.num).padStart(2, '0')} — {category.name}</h1>
      <CategoryAdminClient
        categoryId={categoryId}
        allShapes={(allShapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }))}
        allColors={(allColors || []).map((c: any) => ({ id: c.id, name: c.name, hexValue: c.hex_value, refPhotoUrl: c.ref_photo_url }))}
        allTags={allTags || []}
        allSizes={allSizes || []}
        linkedShapeIds={(linkedShapes || []).map((r: any) => r.shape_id)}
        linkedColorIds={(linkedColors || []).map((r: any) => r.color_id)}
        linkedTagIds={(linkedTags || []).map((r: any) => r.tag_id)}
        linkedSizeIds={(linkedSizes || []).map((r: any) => r.shape_size_id)}
        thumbnailPhotoId={category.thumbnail_photo_id}
        photos={photosFormatted}
        colorPalettes={colorPalettes}
        badgeTypes={(category.badge_types || []) as ('shapes' | 'colors' | 'sizes')[]}
      />
    </>
  );
}
