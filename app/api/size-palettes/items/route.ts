import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Bulk add: body may include either a single size_mm or a sizes[] array
// (comma/newline-separated input from the admin UI), same convenience as
// POST /api/shape-sizes.
export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { palette_id } = body;
  const values: string[] = Array.isArray(body.sizes) ? body.sizes : body.size_mm ? [body.size_mm] : [];
  const rows = values.map((size_mm: string) => ({ palette_id, size_mm: size_mm.trim() })).filter((r) => r.size_mm);
  if (!palette_id || rows.length === 0) return NextResponse.json({ error: 'palette_id and at least one size required' }, { status: 400 });
  const { error } = await supabaseAdmin.from('size_palette_items').upsert(rows, { onConflict: 'palette_id,size_mm', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { palette_id, size_mm } = await req.json();
  const { error } = await supabaseAdmin.from('size_palette_items').delete().eq('palette_id', palette_id).eq('size_mm', size_mm);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
