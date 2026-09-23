import { NextRequest, NextResponse } from 'next/server';
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
  shapes: { id: number; name: string; iconKey: string | null; refPhotoUrl: string | null }[];
  colors: { id: number; name: string; hex: string | null; refPhotoUrl: string | null }[];
  sizes: { id: number; shape_id: number; size_mm: string }[];
};

async function optionsFor(categoryId: number): Promise<CategoryOptions> {
  const [{ data: shapeLinks }, { data: colorLinks }, { data: sizeLinks }] = await Promise.all([
    supabasePublic.from('category_shapes').select('shape_id').eq('category_id', categoryId),
    supabasePublic.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabasePublic.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId)
  ]);

  const shapeIds = (shapeLinks || []).map((r: any) => r.shape_id);
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
    shapes: (shapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: s.ref_photo_url })),
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

  const results = await Promise.all(ids.map(async (id) => [id, await optionsFor(id)] as const));
  const options: Record<number, CategoryOptions> = {};
  results.forEach(([id, value]) => { options[id] = value; });

  return NextResponse.json({ options }, {
    headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=300' }
  });
}
