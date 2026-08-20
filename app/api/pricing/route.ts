import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const [{ data: shapes }, { data: groups }, { data: prices } ] = await Promise.all([
    supabaseAdmin
      .from('category_shapes')
      .select('shape_id, shapes(id, name)')
      .eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name, sort_order').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_rmb').eq('category_id', categoryId)
  ]);

  const shapeIds = (shapes || []).map((s: any) => s.shape_id);
  const { data: sizes } = shapeIds.length
    ? await supabaseAdmin
        .from('category_shape_sizes')
        .select('shape_size_id, shape_sizes(id, shape_id, size_mm)')
        .eq('category_id', categoryId)
    : { data: [] };

  return NextResponse.json({
    shapes: (shapes || []).map((s: any) => ({ id: s.shapes.id, name: s.shapes.name })),
    sizes: (sizes || []).map((s: any) => ({ id: s.shape_sizes.id, shapeId: s.shape_sizes.shape_id, sizeMm: s.shape_sizes.size_mm })),
    groups: groups || [],
    prices: (prices || []).map((p: any) => ({ shapeId: p.shape_id, shapeSizeId: p.shape_size_id, groupId: p.price_group_id, priceRmb: p.price_rmb }))
  });
}

export async function PATCH(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { category_id, shape_id, shape_size_id, price_group_id, price_rmb } = await req.json();
  if (!category_id || !shape_id || !shape_size_id || !price_group_id) {
    return NextResponse.json({ error: 'category_id, shape_id, shape_size_id, price_group_id required' }, { status: 400 });
  }
  if (price_rmb === null || price_rmb === '') {
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
      { category_id, shape_id, shape_size_id, price_group_id, price_rmb },
      { onConflict: 'category_id,shape_id,shape_size_id,price_group_id' }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
