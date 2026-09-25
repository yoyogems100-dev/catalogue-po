import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Put a category under a material, or take it out. Many-to-many: a category
// can sit under several materials.
async function ids(req: NextRequest) {
  const body = await req.json();
  const material_id = Number(body.material_id), category_id = Number(body.category_id);
  return Number.isSafeInteger(material_id) && Number.isSafeInteger(category_id) ? { material_id, category_id } : null;
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await ids(req);
  if (!link) return NextResponse.json({ error: 'Material and category are required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('material_categories').upsert(link, { onConflict: 'material_id,category_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const link = await ids(req);
  if (!link) return NextResponse.json({ error: 'Material and category are required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('material_categories').delete().eq('material_id', link.material_id).eq('category_id', link.category_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
