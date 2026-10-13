import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { specialCategory } from '@/lib/order-specs';
import { MAX_QUALITIES, QUALITIES_SETTING_KEY, QUALITY_MAX_LENGTH, SHAPE_QUALITIES_SETTING_KEY, normalizeQualities, parseCategoryQualities, parseShapeQualities } from '@/lib/qualities';

type Context = { params: Promise<{ id: string }> };

/** Saves which qualities this category's order form offers, in order.
 *  POST { qualities: ["4A", "5A"] } -- an empty list removes the field. */
export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  if (specialCategory(id)) return NextResponse.json({ error: 'This category has its own order options, so it has no quality field.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const qualities = normalizeQualities(body?.qualities);
  if (!qualities) {
    return NextResponse.json({ error: `Up to ${MAX_QUALITIES} qualities, each up to ${QUALITY_MAX_LENGTH} characters.` }, { status: 400 });
  }
  const { data: category } = await supabaseAdmin.from('categories').select('slug').eq('id', id).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  // { shapeId, qualities }: a shape/cut's own list, replacing the category's
  // while it's picked (Nano's Green OSP HW: 3A / AA). An empty list removes it.
  if (body?.shapeId !== undefined) {
    const shapeId = Number(body.shapeId);
    if (!Number.isSafeInteger(shapeId) || shapeId < 1) return NextResponse.json({ error: 'Invalid shape/cut.' }, { status: 400 });
    const { data: link } = await supabaseAdmin.from('category_shapes').select('shape_id').eq('category_id', id).eq('shape_id', shapeId).maybeSingle();
    if (!link) return NextResponse.json({ error: 'That shape/cut is not in this category.' }, { status: 400 });
    const { data: shapeRow, error: shapeReadError } = await supabaseAdmin.from('settings').select('value').eq('key', SHAPE_QUALITIES_SETTING_KEY).maybeSingle();
    if (shapeReadError) return NextResponse.json({ error: shapeReadError.message }, { status: 400 });
    const all = parseShapeQualities(shapeRow?.value);
    const mine = { ...(all[id] || {}) };
    if (qualities.length) mine[shapeId] = qualities; else delete mine[shapeId];
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert({ key: SHAPE_QUALITIES_SETTING_KEY, value: JSON.stringify({ ...all, [id]: mine }) }, { onConflict: 'key' });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (category.slug) revalidatePath(`/po/category/${category.slug}`);
    return NextResponse.json({ ok: true, qualities });
  }
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
