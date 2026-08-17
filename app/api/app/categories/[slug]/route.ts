import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';

// JSON equivalent of getCategoryData() in app/category/[slug]/page.tsx -- powers the
// app's category detail / Place Order flow (needs the linked shapes/colors/sizes to
// build the picker).
export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const { data: category } = await supabasePublic
    .from('categories')
    .select('id, num, name, slug')
    .eq('slug', params.slug)
    .single();

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const [{ data: linkedShapeIds }, { data: linkedColorIds }, { data: linkedSizeIds }] = await Promise.all([
    supabasePublic.from('category_shapes').select('shape_id').eq('category_id', category.id),
    supabasePublic.from('category_colors').select('color_id').eq('category_id', category.id),
    supabasePublic.from('category_shape_sizes').select('shape_size_id').eq('category_id', category.id)
  ]);

  const shapeIds = (linkedShapeIds || []).map((r: any) => r.shape_id);
  const colorIds = (linkedColorIds || []).map((r: any) => r.color_id);
  const sizeIds = (linkedSizeIds || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: sizes }] = await Promise.all([
    shapeIds.length ? supabasePublic.from('shapes').select('id, name, icon_key').in('id', shapeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabasePublic.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabasePublic.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] })
  ]);

  const { data: photos } = await supabasePublic
    .from('photos')
    .select('id, storage_path, drive_id')
    .eq('category_id', category.id)
    .order('sort_order');

  return NextResponse.json({
    category,
    shapes: (shapes || []).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key })),
    colors: (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value })),
    sizes: (sizes || []).map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm })),
    photos: (photos || []).map((p: any) => ({ id: p.id, url: photoUrl(p, 600) }))
  });
}
