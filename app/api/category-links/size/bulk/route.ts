import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Replaces the full set of enabled sizes for one shape within one category.
// Body: { category_id, shape_id, shape_size_ids: number[] }
export async function POST(req: NextRequest) {
  const { category_id, shape_id, shape_size_ids } = await req.json();
  if (!category_id || !shape_id) return NextResponse.json({ error: 'category_id and shape_id required' }, { status: 400 });

  const { data: sizesForShape } = await supabaseAdmin.from('shape_sizes').select('id').eq('shape_id', shape_id);
  const sizeIdsForShape = (sizesForShape || []).map((s: any) => s.id);

  if (sizeIdsForShape.length > 0) {
    await supabaseAdmin.from('category_shape_sizes').delete().eq('category_id', category_id).in('shape_size_id', sizeIdsForShape);
  }

  if (Array.isArray(shape_size_ids) && shape_size_ids.length > 0) {
    const rows = shape_size_ids.map((shape_size_id: number) => ({ category_id, shape_size_id }));
    const { error } = await supabaseAdmin.from('category_shape_sizes').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
