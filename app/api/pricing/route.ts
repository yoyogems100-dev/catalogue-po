import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { priceColumns, groupsInScope } from '@/lib/price-columns';
import { normalizePriceUnit, PRICE_UNIT_MAX } from '@/lib/price-unit';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const [{ data: shapes }, { data: groups }, { data: prices }, { data: categoryColors }, { data: groupMembers }, { data: category } ] = await Promise.all([
    supabaseAdmin
      .from('category_shapes')
      .select('shape_id, shapes(id, name)')
      .eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name, sort_order, is_catch_all, category_id').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_inr').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id, colors(name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id'),
    supabaseAdmin.from('categories').select('price_unit').eq('id', categoryId).single()
  ]);

  const shapeIds = (shapes || []).map((s: any) => s.shape_id);
  const { data: sizes } = shapeIds.length
    ? await supabaseAdmin
        .from('category_shape_sizes')
        .select('shape_size_id, shape_sizes(id, shape_id, size_mm)')
        .eq('category_id', categoryId)
    : { data: [] };

  const sizesFormatted = (sizes || []).map((s: any) => ({ id: s.shape_sizes.id, shapeId: s.shape_sizes.shape_id, sizeMm: s.shape_sizes.size_mm }));
  const shapesWithSizes = new Set(sizesFormatted.map((s) => s.shapeId));

  const colorsFormatted = (categoryColors || [])
    .map((row: any) => ({ id: row.color_id, name: (Array.isArray(row.colors) ? row.colors[0] : row.colors)?.name }))
    .filter((c: any): c is { id: number; name: string } => Boolean(c.name));

  return NextResponse.json({
    // A shape with no size linked to this category has nothing to price, so
    // its tab opened onto an empty table. Ruby Synthetic had four of those.
    shapes: (shapes || []).map((s: any) => ({ id: s.shapes.id, name: s.shapes.name })).filter((s: any) => shapesWithSizes.has(s.id)),
    sizes: sizesFormatted,
    columns: priceColumns(groupsInScope(groups || [], categoryId), colorsFormatted, groupMembers || []),
    prices: (prices || []).map((p: any) => ({ shapeId: p.shape_id, shapeSizeId: p.shape_size_id, groupId: p.price_group_id, priceInr: p.price_inr })),
    // null means "piece" in the column; the UI and the PDFs resolve that
    // through priceUnitLabel() rather than each guessing a default.
    priceUnit: (category as any)?.price_unit ?? null
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { category_id, shape_id, shape_size_id, price_group_id, price_inr } = await req.json();
  if (!category_id || !shape_id || !shape_size_id || !price_group_id) {
    return NextResponse.json({ error: 'category_id, shape_id, shape_size_id, price_group_id required' }, { status: 400 });
  }
  if (price_inr === null || price_inr === '') {
    const { error } = await supabaseAdmin
      .from('shape_size_prices')
      .delete()
      .match({ category_id, shape_id, shape_size_id, price_group_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  const { error } = await supabaseAdmin
    .from('shape_size_prices')
    .upsert(
      { category_id, shape_id, shape_size_id, price_group_id, price_inr },
      { onConflict: 'category_id,shape_id,shape_size_id,price_group_id' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// The unit a category's prices are quoted in ("per piece", "per strip"). It
// sits here rather than on the category CRUD route because it is only ever
// edited from the pricing screen, beside the prices it describes.
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { category_id, price_unit } = await req.json();
  if (!category_id) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const unit = normalizePriceUnit(price_unit);
  if (unit === undefined) return NextResponse.json({ error: `Unit must be 1-${PRICE_UNIT_MAX} characters.` }, { status: 400 });
  const { error } = await supabaseAdmin.from('categories').update({ price_unit: unit }).eq('id', category_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, priceUnit: unit });
}
