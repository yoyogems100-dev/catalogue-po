import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { id, shape_ids, shape_size_ids, color_ids, tag_ids, product_code, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (product_code !== undefined) patch.product_code = product_code || null;
  if (notes !== undefined) patch.notes = notes || null;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabaseAdmin.from('photos').update(patch).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // A photo can now carry several shapes/sizes/colors at once (e.g. a mixed-lot
  // photo) -- each is a delete-then-reinsert of its junction table, same pattern
  // already used for tag_ids below.
  if (Array.isArray(shape_ids)) {
    await supabaseAdmin.from('photo_shapes').delete().eq('photo_id', id);
    if (shape_ids.length > 0) {
      await supabaseAdmin.from('photo_shapes').insert(shape_ids.map((shape_id: number) => ({ photo_id: id, shape_id })));
    }
  }
  if (Array.isArray(shape_size_ids)) {
    await supabaseAdmin.from('photo_sizes').delete().eq('photo_id', id);
    if (shape_size_ids.length > 0) {
      await supabaseAdmin.from('photo_sizes').insert(shape_size_ids.map((shape_size_id: number) => ({ photo_id: id, shape_size_id })));
    }
  }
  if (Array.isArray(color_ids)) {
    await supabaseAdmin.from('photo_colors').delete().eq('photo_id', id);
    if (color_ids.length > 0) {
      await supabaseAdmin.from('photo_colors').insert(color_ids.map((color_id: number) => ({ photo_id: id, color_id })));
    }
  }
  if (Array.isArray(tag_ids)) {
    await supabaseAdmin.from('photo_tags').delete().eq('photo_id', id);
    if (tag_ids.length > 0) {
      await supabaseAdmin.from('photo_tags').insert(tag_ids.map((tag_id: number) => ({ photo_id: id, tag_id })));
    }
  }

  return NextResponse.json({ ok: true });
}
