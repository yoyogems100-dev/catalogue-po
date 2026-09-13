import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const [{ data: shapes }, { data: groups }, { data: prices }, { data: categoryColors }, { data: groupMembers } ] = await Promise.all([
    supabaseAdmin
      .from('category_shapes')
      .select('shape_id, shapes(id, name)')
      .eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name, sort_order').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_rmb').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id, colors(name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id')
  ]);

  const selectedColorIds = new Set((categoryColors || []).map((row: any) => row.color_id));
  const activeGroupIds = new Set((groupMembers || []).filter((row: any) => selectedColorIds.has(row.color_id)).map((row: any) => row.group_id));
  const colorNamesByGroup = new Map<number, string[]>();
  (groupMembers || []).forEach((member: any) => {
    if (!selectedColorIds.has(member.color_id)) return;
    const color = (categoryColors || []).find((row: any) => row.color_id === member.color_id);
    const colorRecord = Array.isArray(color?.colors) ? color.colors[0] : color?.colors;
    if (!colorRecord?.name) return;
    colorNamesByGroup.set(member.group_id, [...(colorNamesByGroup.get(member.group_id) || []), colorRecord.name]);
  });

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
    groups: (groups || []).filter((group: any) => activeGroupIds.has(group.id)).map((group: any) => ({
      ...group,
      colors: (colorNamesByGroup.get(group.id) || []).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    })),
    unassignedColors: (categoryColors || []).filter((row: any) => !(groupMembers || []).some((member: any) => member.color_id === row.color_id)).map((row: any) => (Array.isArray(row.colors) ? row.colors[0] : row.colors)?.name).filter(Boolean),
    prices: (prices || []).map((p: any) => ({ shapeId: p.shape_id, shapeSizeId: p.shape_size_id, groupId: p.price_group_id, priceRmb: p.price_rmb }))
  });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
