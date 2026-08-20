import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCategoryPricing } from '@/lib/pricing';

// Returns the shapes/colors/sizes linked to a category -- used by the admin
// "create order" builder to populate pickers as each category is added,
// without pulling the entire catalog upfront.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categoryId = Number(params.id);

  const [{ data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    supabaseAdmin.from('category_shapes').select('shape_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId)
  ]);

  const shapeIds = (catShapes || []).map((r: any) => r.shape_id);
  const colorIds = (catColors || []).map((r: any) => r.color_id);
  const sizeIds = (catSizes || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: sizes }] = await Promise.all([
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds) : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value').in('id', colorIds) : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] })
  ]);

  const pricing = await getCategoryPricing(categoryId, supabaseAdmin);

  return NextResponse.json({
    shapes: (shapes || []).map((s: any) => ({ id: s.id, name: s.name })),
    colors: (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value })),
    sizes: (sizes || []).map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm })),
    pricing
  });
}
