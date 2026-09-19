import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getCategoryPricing } from '@/lib/pricing';

// Returns the shapes/colors/sizes linked to a category -- used by the admin
// "create order" builder to populate pickers as each category is added,
// without pulling the entire catalog upfront.
export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categoryId = Number(params.id);

  const [{ data: catShapes }, { data: catColors }, { data: catSizes }] = await Promise.all([
    // ref_photo_url here is the category's own shape photo, which wins over the
    // shape's shared default -- same precedence the public category route uses.
    supabaseAdmin.from('category_shapes').select('shape_id, ref_photo_url').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId)
  ]);

  const shapeIds = (catShapes || []).map((r: any) => r.shape_id);
  const colorIds = (catColors || []).map((r: any) => r.color_id);
  const sizeIds = (catSizes || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: sizes }] = await Promise.all([
    shapeIds.length ? supabaseAdmin.from('shapes').select('id, name, icon_key, ref_photo_url').in('id', shapeIds).order('sort_order').order('name') : Promise.resolve({ data: [] }),
    colorIds.length ? supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds).order('sort_order').order('name') : Promise.resolve({ data: [] }),
    sizeIds.length ? supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] })
  ]);

  const pricing = await getCategoryPricing(categoryId, supabaseAdmin);

  return NextResponse.json({
    // Icons and reference photos are included so the admin builder's pickers
    // can look like the customer-facing ones instead of bare native selects.
    shapes: (shapes || []).map((s: any) => {
      const link: any = (catShapes || []).find((l: any) => l.shape_id === s.id);
      return { id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: link?.ref_photo_url || s.ref_photo_url || null };
    }),
    colors: (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url })),
    sizes: (sizes || []).map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm })),
    pricing
  });
}
