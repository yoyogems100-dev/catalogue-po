import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Links every selected shape and every selected color to every selected
// category in one action -- e.g. 3 shapes x 2 colors x 4 categories links
// all 3 shapes and both colors to all 4 categories in a single request,
// instead of one link at a time per shape/color as the existing
// /api/category-links/{shape,color} routes require.
// Body: { categoryIds: number[], shapeIds?: number[], colorIds?: number[] }
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { categoryIds, shapeIds, colorIds } = await req.json();
  const catIds: number[] = Array.isArray(categoryIds) ? categoryIds : [];
  const shpIds: number[] = Array.isArray(shapeIds) ? shapeIds : [];
  const clrIds: number[] = Array.isArray(colorIds) ? colorIds : [];

  if (catIds.length === 0 || (shpIds.length === 0 && clrIds.length === 0)) {
    return NextResponse.json(
      { error: 'Pick at least one category and at least one shape or color.' },
      { status: 400 }
    );
  }

  let shapeLinks = 0;
  let colorLinks = 0;

  if (shpIds.length > 0) {
    const rows = catIds.flatMap((category_id) => shpIds.map((shape_id) => ({ category_id, shape_id })));
    const { error, count } = await supabaseAdmin
      .from('category_shapes')
      .upsert(rows, { onConflict: 'category_id,shape_id', ignoreDuplicates: true, count: 'exact' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    shapeLinks = count ?? rows.length;
  }

  if (clrIds.length > 0) {
    const rows = catIds.flatMap((category_id) => clrIds.map((color_id) => ({ category_id, color_id })));
    const { error, count } = await supabaseAdmin
      .from('category_colors')
      .upsert(rows, { onConflict: 'category_id,color_id', ignoreDuplicates: true, count: 'exact' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    colorLinks = count ?? rows.length;
  }

  return NextResponse.json({
    ok: true,
    categoriesAffected: catIds.length,
    shapesLinked: shpIds.length,
    colorsLinked: clrIds.length,
    shapeLinkRows: shapeLinks,
    colorLinkRows: colorLinks
  });
}
