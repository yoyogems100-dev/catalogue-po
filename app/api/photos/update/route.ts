import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { id, shape_id, shape_size_id, color_id, tag_ids, product_code, notes } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, any> = {};
  if (shape_id !== undefined) patch.shape_id = shape_id ?? null;
  if (shape_size_id !== undefined) patch.shape_size_id = shape_size_id ?? null;
  if (color_id !== undefined) patch.color_id = color_id ?? null;
  if (product_code !== undefined) patch.product_code = product_code || null;
  if (notes !== undefined) patch.notes = notes || null;

  const { error } = await supabaseAdmin
    .from('photos')
    .update(patch)
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (Array.isArray(tag_ids)) {
    await supabaseAdmin.from('photo_tags').delete().eq('photo_id', id);
    if (tag_ids.length > 0) {
      await supabaseAdmin.from('photo_tags').insert(tag_ids.map((tag_id: number) => ({ photo_id: id, tag_id })));
    }
  }

  return NextResponse.json({ ok: true });
}
