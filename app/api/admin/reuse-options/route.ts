import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { loadReuseOptions } from '@/lib/reuse-options';

/** Shape and colour photos, and which shapes use each drawing, to choose from. */
export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await loadReuseOptions(supabaseAdmin));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load.' }, { status: 400 });
  }
}
