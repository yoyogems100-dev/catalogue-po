import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { DISCUSSION_PLACES_SETTING_KEY, sanitizePlaces } from '@/lib/discussions';

/** Saves the Place list offered for discussions. PUT { places: string[] } */
export async function PUT(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.places)) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
  const places = sanitizePlaces(body.places);
  catalogueChanged(); // settings are read through the catalogue cache
  const { error } = await supabaseAdmin.from('settings')
    .upsert({ key: DISCUSSION_PLACES_SETTING_KEY, value: JSON.stringify(places) }, { onConflict: 'key' });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, places });
}
