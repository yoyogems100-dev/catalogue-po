import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Moves selected photos into a different category, appending them after that
// category's existing photos. Shape/color/size/spec tags stay on each photo --
// they're catalogue-wide attributes, not category-specific -- so the admin can
// retag afterwards if the new category needs different ones.
// Body: { ids: number[], to_category_id: number }
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { ids, to_category_id } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0 || !to_category_id) {
    return NextResponse.json({ error: 'ids and to_category_id required' }, { status: 400 });
  }

  const { data: last, error: lastError } = await supabaseAdmin
    .from('photos')
    .select('sort_order')
    .eq('category_id', to_category_id)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (lastError) return NextResponse.json({ error: lastError.message }, { status: 400 });
  let nextSortOrder = (last?.[0]?.sort_order ?? -1) + 1;

  for (const id of ids) {
    const { error } = await supabaseAdmin
      .from('photos')
      .update({ category_id: to_category_id, sort_order: nextSortOrder })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    nextSortOrder++;
  }

  // A moved photo can't stay set as its old category's cover.
  await supabaseAdmin.from('categories').update({ thumbnail_photo_id: null }).in('thumbnail_photo_id', ids);

  return NextResponse.json({ ok: true });
}
