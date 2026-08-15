import { supabasePublic } from '@/lib/supabase-public';
import { getSettings } from '@/lib/settings';
import CategoryTabs from './CategoryTabs';
import Footer from '@/components/Footer';
import HeaderLogo from '@/components/HeaderLogo';
import Link from 'next/link';

export const revalidate = 30;

async function getCategoryData(slug: string) {
  const { data: category } = await supabasePublic
    .from('categories')
    .select('id, num, name, slug')
    .eq('slug', slug)
    .single();

  if (!category) return null;

  const [{ data: linkedShapeIds }, { data: linkedColorIds }, { data: linkedTagIds }, { data: linkedSizeIds }] = await Promise.all([
    supabasePublic.from('category_shapes').select('shape_id').eq('category_id', category.id),
    supabasePublic.from('category_colors').select('color_id').eq('category_id', category.id),
    supabasePublic.from('category_tags').select('tag_id').eq('category_id', category.id),
    supabasePublic.from('category_shape_sizes').select('shape_size_id').eq('category_id', category.id)
  ]);

  const shapeIds = (linkedShapeIds || []).map((r: any) => r.shape_id);
  const colorIds = (linkedColorIds || []).map((r: any) => r.color_id);
  const tagIds = (linkedTagIds || []).map((r: any) => r.tag_id);
  const sizeIds = (linkedSizeIds || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: tags }, { data: sizes }] = await Promise.all([
    shapeIds.length ? supabasePublic.from('shapes').select('id, name, icon_key, ref_photo_url').in('id', shapeIds) : { data: [] },
    colorIds.length ? supabasePublic.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds) : { data: [] },
    tagIds.length ? supabasePublic.from('tags').select('id, name').in('id', tagIds) : { data: [] },
    sizeIds.length ? supabasePublic.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds) : { data: [] }
  ]);

  const { data: photos } = await supabasePublic
    .from('photos')
    .select('id, storage_path, drive_id, shape_id, shape_size_id, color_id, photo_tags(tag_id)')
    .eq('category_id', category.id)
    .order('sort_order');

  const photosWithUrl = (photos || []).map((p: any) => ({
    id: p.id,
    url: p.storage_path
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${p.storage_path}`
      : p.drive_id
      ? `https://lh3.googleusercontent.com/d/${p.drive_id}=w800`
      : null,
    shape_id: p.shape_id,
    shape_size_id: p.shape_size_id,
    color_id: p.color_id,
    tag_ids: (p.photo_tags || []).map((t: any) => t.tag_id)
  }));

  const shapesFormatted = (shapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: s.ref_photo_url }));
  const colorsFormatted = (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }));

  return { category, shapes: shapesFormatted, colors: colorsFormatted, tags: tags || [], sizes: sizes || [], photos: photosWithUrl };
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const [data, settings] = await Promise.all([getCategoryData(params.slug), getSettings()]);

  if (!data) {
    return (
      <div className="container" style={{ padding: 60 }}>
        <p>Category not found.</p>
        <Link href="/">&larr; Back</Link>
      </div>
    );
  }

  return (
    <>
      <div className="topbar">
        <Link href="/"><HeaderLogo height={28} /></Link>
      </div>
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <Link href="/" style={{ fontSize: 13, color: 'var(--navy)' }}>&larr; All categories</Link>
        <h1 style={{ fontSize: 28, color: 'var(--ink)', margin: '10px 0 4px' }}>{data.category.name}</h1>
        <CategoryTabs
          categoryId={data.category.id}
          categoryName={data.category.name}
          whatsappNumber={settings.whatsapp_number}
          shapes={data.shapes}
          colors={data.colors}
          tags={data.tags}
          sizes={data.sizes}
          photos={data.photos}
        />
      </div>
      <Footer settings={settings} />
    </>
  );
}
