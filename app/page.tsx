import { supabasePublic } from '@/lib/supabase-public';
import { getSettings } from '@/lib/settings';
import { photoUrl } from '@/lib/photos';
import { getAccountState } from '@/lib/account-state';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import Footer from '@/components/Footer';
import HomeCatalogue from './HomeCatalogue';
import HomeHero from '@/components/HomeHero';

export const revalidate = 30; // re-check for new photos/categories every 30s

// Only the columns the catalogue grid actually reads: enough to resolve a
// thumbnail URL (storage_path / drive_id / either saved crop) and to pick the
// right photo per category. `select('*')` also dragged down every other photo
// column for all 287 rows on each render.
const PHOTO_COLUMNS = 'id, category_id, is_cover_only, storage_path, drive_id, photo_crop, cover_crop';
type PhotoRow = {
  id: number; category_id: number; is_cover_only: boolean | null;
  storage_path: string | null; drive_id: string | null;
  photo_crop: { path?: string } | null; cover_crop: { path?: string } | null;
};

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
    supabasePublic.from('categories').select('id, num, name, slug, thumbnail_photo_id, badge_types').order('num'),
    // These four read every row of their table with no per-category filter (there's
    // no category to filter by yet -- this is what builds the per-category counts
    // below), so each must page past the project's 1000-row response cap explicitly
    // or silently drop rows for whichever categories land past the first page.
    //
    // Each asks for { count: 'exact' } so fetchAllRows knows the total up front and
    // can request every remaining page in parallel. Without the count it falls back
    // to fetching pages one at a time -- category_shape_sizes alone is 4000+ rows,
    // so that fallback costs five sequential Supabase round-trips per render.
    fetchAllRows<PhotoRow>((from, to) => supabasePublic.from('photos').select(PHOTO_COLUMNS, { count: 'exact' }).order('sort_order', { ascending: true }).order('id', { ascending: true }).range(from, to)),
    fetchAllRows<{ category_id: number; shape_id: number }>((from, to) => supabasePublic.from('category_shapes').select('category_id, shape_id', { count: 'exact' }).range(from, to)),
    fetchAllRows<{ category_id: number; color_id: number }>((from, to) => supabasePublic.from('category_colors').select('category_id, color_id', { count: 'exact' }).range(from, to)),
    fetchAllRows<{ category_id: number }>((from, to) => supabasePublic.from('category_shape_sizes').select('category_id', { count: 'exact' }).range(from, to)),
    supabasePublic.from('shapes').select('id, name, icon_key').order('sort_order').order('name'),
    supabasePublic.from('colors').select('id, name, hex_value, ref_photo_url').order('sort_order').order('name')
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

  // A dedicated cover-only upload never stands in as the fallback thumbnail
  // for a category that hasn't explicitly set one -- explicit lookups by
  // thumbnail_photo_id below still find it fine either way.
  const firstPhotoByCategory: Record<number, any> = {};
  (photos || []).forEach((p: any) => {
    if (!p.is_cover_only && !firstPhotoByCategory[p.category_id]) firstPhotoByCategory[p.category_id] = p;
  });
  const photoById: Record<number, any> = {};
  (photos || []).forEach((p: any) => { photoById[p.id] = p; });

  const categoriesFormatted = (categories || []).map((c) => {
    const thumbPhoto = (c.thumbnail_photo_id && photoById[c.thumbnail_photo_id]) || firstPhotoByCategory[c.id] || null;
    const shapeIds = shapeIdsByCategory[c.id] || [];
    const colorIds = colorIdsByCategory[c.id] || [];
    return {
      ...c,
      thumb: thumbPhoto ? photoUrl(thumbPhoto, 500, 'cover') : null,
      shapeIds,
      colorIds,
      shapeCount: shapeIds.length,
      colorCount: colorIds.length,
      sizeCount: sizeCounts[c.id] || 0,
      badgeTypes: (c.badge_types || ['shapes']) as ('shapes' | 'colors' | 'sizes')[]
    };
  });

  const shapesFormatted = (allShapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key }));
  const colorsFormatted = (allColors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }));

  return { categories: categoriesFormatted, allShapes: shapesFormatted, allColors: colorsFormatted };
}

export default async function HomePage() {
  const [{ categories, allShapes, allColors }, settings, account] = await Promise.all([getData(), getSettings(), getAccountState()]);

  return (
    <>
      <HomeHero loggedIn={account.loggedIn} customerName={account.customerName} />
      <div className="container" style={{ padding: '28px 20px 80px' }}>
        {/* The visible branding in HomeHero is a stylized logo image, not real
            text -- a true H1 keeps the page's heading structure sound for
            screen readers without changing what's shown on screen. */}
        <h1 className="visually-hidden">YOYO GEMS — Collection Catalogue</h1>
        <HomeCatalogue categories={categories} allShapes={allShapes} allColors={allColors} />
      </div>
      <Footer settings={settings} />
    </>
  );
}
