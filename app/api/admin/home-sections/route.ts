import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { HOME_SECTIONS_SETTING_KEY, parseHomeSections, serializeHomeSections } from '@/lib/home-sections';

/** Saves the /po home page shelves. POST { sections, restTitle } */
export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.sections)) return NextResponse.json({ error: 'sections required' }, { status: 400 });
  if (body.sections.length > 12) return NextResponse.json({ error: 'At most 12 sections.' }, { status: 400 });
  // Round-trip through the parser so only clean, known fields are stored.
  const value = serializeHomeSections(parseHomeSections(JSON.stringify(body)));
  const { error } = await supabaseAdmin.from('settings').upsert({ key: HOME_SECTIONS_SETTING_KEY, value }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  revalidatePath('/po');
  return NextResponse.json({ ok: true, value: JSON.parse(value) });
}
