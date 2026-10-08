import { NextRequest, NextResponse } from 'next/server';
import { getQuantityFields } from '@/lib/quantity-fields-server';
import { holePhotos, type HoleCount } from '@/lib/drill-data';
import { supabasePublic } from '@/lib/supabase-public';

// The shapes, colours and sizes a category offers, for one or more categories.
//
// /po/cart holds lines from any number of categories and lets a buyer change a
// line's size or colour there. The category page gets these options
// server-rendered; the cart page has no single category to render from, so it
// asks for exactly the categories sitting in the basket.
//
// Read through the anon client and its public read policies -- this is the same
// catalogue data the category pages already publish.

const MAX_CATEGORIES = 25;

type CategoryOptions = {
  /** Today's name -- a cart line keeps the name it was added under. */
  name?: string;
  /** What a quantity counts here ("lines"); null means pieces. */
  qtyUnit?: string | null;
  shapes: { id: number; name: string; iconKey: string | null; refPhotoUrl: string | null; holePhotos?: Partial<Record<HoleCount, string>> }[];
  colors: { id: number; name: string; hex: string | null; refPhotoUrl: string | null }[];
  sizes: { id: number; shape_id: number; size_mm: string }[];
};

async function optionsFor(categoryId: number, fieldOf: (id: number) => { unit: string | null }): Promise<CategoryOptions> {
  const [{ data: category }, { data: shapeLinks }, { data: colorLinks }, { data: sizeLinks }] = await Promise.all([
    supabasePublic.from('categories').select('name').eq('id', categoryId).maybeSingle(),
    supabasePublic.from('category_shapes').select('shape_id, ref_photo_url, drill').eq('category_id', categoryId),
    supabasePublic.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabasePublic.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId)
  ]);

  const shapeIds = (shapeLinks || []).map((r: any) => r.shape_id);
  // The category's own shape photo wins over the shared one, as on the category page.
  const drillOf = (shapeId: number) => { const l: any = (shapeLinks || []).find((r: any) => r.shape_id === shapeId); return l?.drill ? holePhotos(l.drill, l.ref_photo_url) : undefined; };
  const categoryPhoto = new Map((shapeLinks || []).filter((r: any) => r.ref_photo_url).map((r: any) => [r.shape_id, r.ref_photo_url]));
  const colorIds = (colorLinks || []).map((r: any) => r.color_id);
  const sizeIds = (sizeLinks || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: sizes }] = await Promise.all([
    shapeIds.length
      ? supabasePublic.from('shapes').select('id, name, icon_key, ref_photo_url').in('id', shapeIds).order('sort_order').order('name')
      : Promise.resolve({ data: [] as any[] }),
    colorIds.length
      ? supabasePublic.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds).order('sort_order').order('name')
      : Promise.resolve({ data: [] as any[] }),
    sizeIds.length
      ? supabasePublic.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds)
      : Promise.resolve({ data: [] as any[] })
  ]);

  return {
    name: (category as any)?.name || undefined,
    qtyUnit: fieldOf(categoryId).unit,
    shapes: (shapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: categoryPhoto.get(s.id) || s.ref_photo_url, holePhotos: drillOf(s.id) })),
    colors: (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url })),
    sizes: (sizes || []).map((s: any) => ({ id: s.id, shape_id: s.shape_id, size_mm: s.size_mm }))
  };
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('ids') || '';
  const ids = Array.from(new Set(
    raw.split(',').map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n > 0)
  )).slice(0, MAX_CATEGORIES);

  if (!ids.length) return NextResponse.json({ options: {} });

  const fieldOf = await getQuantityFields();
  const results = await Promise.all(ids.map(async (id) => [id, await optionsFor(id, fieldOf)] as const));
  const options: Record<number, CategoryOptions> = {};
  results.forEach(([id, value]) => { options[id] = value; });

  return NextResponse.json({ options }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' }
  });
}
