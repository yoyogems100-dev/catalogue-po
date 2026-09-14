import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  // photo) -- each is a delete-then-reinsert of its own junction table. The four
  // tables are independent of each other (only the delete-then-insert within
  // each needs to stay in order), so run them concurrently instead of as one
  // long sequential chain, and surface a failure instead of silently ignoring it.
  async function replaceJunction(table: string, column: string, ids: number[] | undefined) {
    if (!Array.isArray(ids)) return null;
    const del = await supabaseAdmin.from(table).delete().eq('photo_id', id);
    if (del.error) return del.error.message;
    if (ids.length > 0) {
      const ins = await supabaseAdmin.from(table).insert(ids.map((value) => ({ photo_id: id, [column]: value })));
      if (ins.error) return ins.error.message;
    }
    return null;
  }

  const junctionErrors = (await Promise.all([
    replaceJunction('photo_shapes', 'shape_id', shape_ids),
    replaceJunction('photo_sizes', 'shape_size_id', shape_size_ids),
    replaceJunction('photo_colors', 'color_id', color_ids),
    replaceJunction('photo_tags', 'tag_id', tag_ids)
  ])).filter((e): e is string => e !== null);
  if (junctionErrors.length > 0) return NextResponse.json({ error: junctionErrors.join('; ') }, { status: 400 });

  return NextResponse.json({ ok: true });
}
