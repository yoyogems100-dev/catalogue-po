import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { FIELD_LABEL_MAX, FORM_FIELDS_SETTING_KEY, normalizeFormFields, parseFormFields } from '@/lib/form-fields';
import { catalogueChanged } from '@/lib/catalogue-cache';

type Context = { params: Promise<{ id: string }> };

/** Saves this category's field names and hidden fields.
 *  POST { labels: { shape: "Shape / Cut" }, hidden: ["size"] } */
export async function POST(request: NextRequest, context: Context) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
  const fields = normalizeFormFields(await request.json().catch(() => null));
  if (!fields) return NextResponse.json({ error: `Field names up to ${FIELD_LABEL_MAX} characters.` }, { status: 400 });
  const { data: category } = await supabaseAdmin.from('categories').select('slug').eq('id', id).maybeSingle();
  if (!category) return NextResponse.json({ error: 'Category not found.' }, { status: 404 });

  const { data: row, error: readError } = await supabaseAdmin.from('settings').select('value').eq('key', FORM_FIELDS_SETTING_KEY).maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  const all = { ...parseFormFields(row?.value), [id]: fields };
  const { error } = await supabaseAdmin
    .from('settings')
    .upsert({ key: FORM_FIELDS_SETTING_KEY, value: JSON.stringify(all) }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (category.slug) revalidatePath(`/po/category/${category.slug}`);
  return NextResponse.json({ ok: true, fields });
}
