import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { specialCategory } from '@/lib/order-specs';
import { MAX_QUALITIES, QUALITIES_SETTING_KEY, QUALITY_MAX_LENGTH, normalizeQualities, parseCategoryQualities } from '@/lib/qualities';

type Context = { params: Promise<{ id: string }> };

/** Saves which qualities this category's order form offers, in order.
 *  POST { qualities: ["4A", "5A"] } -- an empty list removes the field. */
export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  if (specialCategory(id)) return NextResponse.json({ error: 'This category has its own order options, so it has no quality field.' }, { status: 400 });
  const qualities = normalizeQualities((await request.json().catch(() => null))?.qualities);
  if (!qualities) {
    return NextResponse.json({ error: `Up to ${MAX_QUALITIES} qualities, each up to ${QUALITY_MAX_LENGTH} characters.` }, { status: 400 });
  }
  const { data: category } = await supabaseAdmin.from('categories').select('slug').eq('id', id).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  const { data: row, error: readError } = await supabaseAdmin.from('settings').select('value').eq('key', QUALITIES_SETTING_KEY).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  const all = { ...parseCategoryQualities(row?.value), [id]: qualities };
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: QUALITIES_SETTING_KEY, value: JSON.stringify(all) }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (category.slug) revalidatePath(`/po/category/${category.slug}`);
  return NextResponse.json({ ok: true, qualities });
}
