import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { parseExploreFilter, toStoredFilter } from '@/lib/explore-filter';

type Context = { params: Promise<{ id: string }> };

/** Saves (or, with an empty filter, clears) the filter this category's
 *  Explore Photos tab opens with. POST { shape_id, size_key, color_id, tag_id } */
export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const stored = toStoredFilter(parseExploreFilter(body));
  const { data, error } = await supabaseAdmin
    .from('categories')
    .update({ explore_default_filter: stored })
    .eq('id', id)
    .select('slug')
    .single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Category not found.' }, { status: 400 });
  if (data.slug) revalidatePath(`/po/category/${data.slug}`);
  return NextResponse.json({ ok: true, filter: stored });
}
