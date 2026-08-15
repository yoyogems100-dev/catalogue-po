import { supabasePublic } from '@/lib/supabase-public';
import { getSettings } from '@/lib/settings';
import { photoUrl } from '@/lib/photos';
import Footer from '@/components/Footer';
import HomeCatalogue from './HomeCatalogue';
import HomeHero from '@/components/HomeHero';

export const revalidate = 30; // re-check for new photos/categories every 30s

async function getData() {
  const [
    { data: categories },
    { data: photos },
    { data: catShapes },
    { data: catColors },
    { data: catSizes },
    { data: allShapes },
    { data: allColors }
  ] = await Promise.all([
    supabasePublic.from('categories').select('id, num, name, slug, thumbnail_photo_id').order('num'),
    supabasePublic.from('photos').select('id, category_id, storage_path, drive_id, sort_order').order('sort_order', { ascending: true }).order('id', { ascending: true }),
    supabasePublic.from('category_shapes').select('category_id, shape_id'),
    supabasePublic.from('category_colors').select('category_id, color_id'),
    supabasePublic.from('category_shape_sizes').select('category_id'),
    supabasePublic.from('shapes').select('id, name, icon_key').order('name'),
    supabasePublic.from('colors').select('id, name, hex_value').order('name')
  ]);

  function countBy(rows: { category_id: number }[] | null) {
    const counts: Record<number, number> = {};
    (rows || []).forEach((r) => { counts[r.category_id] = (counts[r.category_id] || 0) + 1; });
    return counts;
  }
  function idsBy(rows: any[] | null, key: string) {
    const map: Record<number, number[]> = {};
    (rows || []).forEach((r) => {
      if (!map[r.category_id]) map[r.category_id] = [];
      map[r.category_id].push(r[key]);
    });
    return map;
  }

  const sizeCounts = countBy(catSizes);
  const shapeIdsByCategory = idsBy(catShapes, 'shape_id');
  const colorIdsByCategory = idsBy(catColors, 'color_id');

  const firstPhotoByCategory: Record<number, any> = {};
  (photos || []).forEach((p: any) => {
    if (!firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
  });
  const photoById: Record<number, any> = {};
  (photos || []).forEach((p: any) => { photoById[p.id] = p; });

  const categoriesFormatted = (categories || []).map((c) => {
    const thumbPhoto = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
    const shapeIds = shapeIdsByCategory[c.id] || [];
    const colorIds = colorIdsByCategory[c.id] || [];
    return {
      ...c,
      thumb: thumbPhoto ? photoUrl(thumbPhoto, 500) : null,
      shapeIds,
      colorIds,
      shapeCount: shapeIds.length,
      colorCount: colorIds.length,
      sizeCount: sizeCounts[c.id] || 0
    };
  });

  const shapesFormatted = (allShapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }));
  const colorsFormatted = (allColors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value }));

  return { categories: categoriesFormatted, allShapes: shapesFormatted, allColors: colorsFormatted };
}

export default async function HomePage() {
  const [{ categories, allShapes, allColors }, settings] = await Promise.all([getData(), getSettings()]);

  return (
    <>
      <HomeHero />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        <HomeCatalogue categories={categories} allShapes={allShapes} allColors={allColors} />
      </div>
      <Footer settings={settings} />
    </>
  );
}
