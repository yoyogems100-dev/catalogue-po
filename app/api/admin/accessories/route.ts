import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { ACCESSORIES_SETTING_KEY, parseOverrides, serializeOverrides } from '@/lib/accessories/overrides';

/** Saves Admin > Accessories edits. POST { page, order, ranges, styles } */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  // Round-trip through the parser so only clean, known fields are stored.
  const value = serializeOverrides(parseOverrides(body));
  const { error } = await supabaseAdmin.from('settings').upsert({ key: ACCESSORIES_SETTING_KEY, value }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, value: JSON.parse(value) });
}
