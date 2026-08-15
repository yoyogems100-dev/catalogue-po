import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Bulk-imports photos that are already sitting on Google Drive (e.g. the set
// already pulled into the first-pass artifact) without re-uploading files.
// Body: { category_id: number, drive_ids: string[] }
export async function POST(req: NextRequest) {
  const { category_id, drive_ids } = await req.json();
  if (!category_id || !Array.isArray(drive_ids) || drive_ids.length === 0) {
    return NextResponse.json({ error: 'category_id and drive_ids[] required' }, { status: 400 });
  }

  const rows = drive_ids.map((drive_id: string) => ({ category_id, drive_id }));
  const { data, error } = await supabaseAdmin.from('photos').insert(rows).select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ imported: data.length });
}
