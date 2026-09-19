import { NextRequest, NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase-public';
import { photoUrl } from '@/lib/photos';
import { getCategoryPricing } from '@/lib/pricing';

// JSON equivalent of getCategoryData() in app/category/[slug]/page.tsx -- powers the
// app's category detail / Place Order flow (needs the linked shapes/colors/sizes to
// build the picker).
export async function GET(req: NextRequest, { params: paramsPromise }: { params: Promise<{ slug: string }> }) {
  const params = await paramsPromise;
  const { data: category } = await supabasePublic
    .from('categories')
    .select('id, num, name, slug, color_chart_url')
    .eq('slug', params.slug)
    .single();

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const [{ data: linkedShapeIds }, { data: linkedColorIds }, { data: linkedSizeIds }] = await Promise.all([
    supabasePublic.from('category_shapes').select('*').eq('category_id', category.id),
    supabasePublic.from('category_colors').select('color_id').eq('category_id', category.id),
    supabasePublic.from('category_shape_sizes').select('shape_size_id').eq('category_id', category.id)
  ]);

  const shapeIds = (linkedShapeIds || []).map((r: any) => r.shape_id);
  const colorIds = (linkedColorIds || []).map((r: any) => r.color_id);
  const sizeIds = (linkedSizeIds || []).map((r: any) => r.shape_size_id);

  const [{ data: shapes }, { data: colors }, { data: sizes }] = await Promise.all([
    shapeIds.length ? supabasePublic.from('shapes').select('id, name, icon_key, ref_photo_url').in('id', shapeIds).order('sort_order').order('name') : Promise.resolve({ data: [] }),
    colorIds.length ? supabasePublic.from('colors').select('id, name, hex_value, ref_photo_url').in('id', colorIds).order('sort_order').order('name') : Promise.resolve({ data: [] }),
    sizeIds.length ? supabasePublic.from('shape_sizes').select('id, shape_id, size_mm').in('id', sizeIds) : Promise.resolve({ data: [] })
  ]);

  // Same joins as getCategoryData() in app/category/[slug]/page.tsx, so the
  // Quick Order picker's reference-photo strip filters exactly like the
  // regular per-category composer. is_cover_only is excluded -- a dedicated
  // cover upload isn't a catalogue stone.
  const { data: photos } = await supabasePublic
    .from('photos')
    .select('*, photo_shapes(shape_id), photo_sizes(shape_size_id), photo_colors(color_id)')
    .eq('category_id', category.id)
    .eq('is_cover_only', false)
    .order('sort_order');

  const pricing = await getCategoryPricing(category.id);

  return NextResponse.json({
    category,
    colorChartUrl: category.color_chart_url,
    shapes: (shapes || []).map((s: any) => {
      const link: any = linkedShapeIds?.find(link => link.shape_id === s.id);
      // A real photo -- this category's own upload, or the shared default for this shape
      // (e.g. the Moissanite gemstone photos, close enough across categories that a
      // dedicated photo per category isn't needed) -- is shown automatically whenever
      // one is available; every category_shapes row defaults to reference_style='vector'
      // at creation regardless of whether anyone ever chose it, so it's not a signal of
      // deliberate intent and isn't used to suppress an available photo.
      const photoUrl = link?.ref_photo_url || s.ref_photo_url || null;
      return { id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: photoUrl };
    }),
    colors: (colors || []).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url })),
    sizes: (sizes || []).map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm })),
    photos: (photos || []).map((p: any) => ({
      id: p.id,
      url: photoUrl(p, 600),
      shapeIds: (p.photo_shapes || []).map((r: any) => r.shape_id),
      sizeIds: (p.photo_sizes || []).map((r: any) => r.shape_size_id),
      colorIds: (p.photo_colors || []).map((r: any) => r.color_id)
    })),
    pricing
  });
}
