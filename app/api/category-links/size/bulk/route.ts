import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Replaces the full set of enabled sizes for one shape within one category.
// Body: { category_id, shape_id, shape_size_ids: number[] }
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { category_id, shape_id, shape_size_ids } = await req.json();
  if (!category_id || !shape_id) return NextResponse.json({ error: 'category_id and shape_id required' }, { status: 400 });

  const { data: sizesForShape } = await supabaseAdmin.from('shape_sizes').select('id').eq('shape_id', shape_id);
  const sizeIdsForShape = (sizesForShape || []).map((s: any) => s.id);

  if (sizeIdsForShape.length > 0) {
    await supabaseAdmin.from('category_shape_sizes').delete().eq('category_id', category_id).in('shape_size_id', sizeIdsForShape);
  }

  if (Array.isArray(shape_size_ids) && shape_size_ids.length > 0) {
    // Only accept ids that actually belong to shape_id -- otherwise a stale
    // client id (or any bug upstream) can link a size from a completely
    // different shape into this category under shape_id's name.
    const validIds = new Set(sizeIdsForShape);
    const rows = shape_size_ids.filter((id: number) => validIds.has(id)).map((shape_size_id: number) => ({ category_id, shape_size_id }));
    if (rows.length > 0) {
      const { error } = await supabaseAdmin.from('category_shape_sizes').insert(rows);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
