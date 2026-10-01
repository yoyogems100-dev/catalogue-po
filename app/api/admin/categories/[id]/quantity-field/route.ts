import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeQuantityField, parseQuantityFields, QUANTITY_FIELDS_SETTING_KEY, QUANTITY_LABEL_MAX, DEFAULT_QTY_MAX } from '@/lib/quantity-field';

type Context = { params: Promise<{ id: string }> };

/** Saves what this category's quantity field is called and starts on.
 *  POST { label, defaultQty } -- blanks mean "Qty (pcs)", empty. */
export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  const field = normalizeQuantityField(await request.json().catch(() => null));
  if (!field) {
    return NextResponse.json({ error: `Label up to ${QUANTITY_LABEL_MAX} characters; default a whole number from 1 to ${DEFAULT_QTY_MAX.toLocaleString('en-IN')}.` }, { status: 400 });
  }
  const { data: category } = await supabaseAdmin.from('categories').select('slug').eq('id', id).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  const { data: row } = await supabaseAdmin.from('settings').select('value').eq('key', QUANTITY_FIELDS_SETTING_KEY).maybeSingle();
  const all = { ...parseQuantityFields(row?.value), [id]: field };
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: QUANTITY_FIELDS_SETTING_KEY, value: JSON.stringify(all) }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (category.slug) revalidatePath(`/po/category/${category.slug}`);
  return NextResponse.json({ ok: true, field });
}
