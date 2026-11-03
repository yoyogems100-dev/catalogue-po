import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { ROUND_SIZE_MESSAGE, sizeFitsShape } from '@/lib/shape-size-fit';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  catalogueChanged();
  const { category_id, shape_size_id } = await req.json();
  const { data: size } = await supabaseAdmin.from('shape_sizes').select('size_mm, shapes(name)').eq('id', shape_size_id).maybeSingle();
  if (size && !sizeFitsShape((size as any).shapes?.name, size.size_mm)) return NextResponse.json({ error: ROUND_SIZE_MESSAGE }, { status: 400 });
  const { error } = await supabaseAdmin.from('category_shape_sizes').upsert({ category_id, shape_size_id }, { onConflict: 'category_id,shape_size_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  catalogueChanged();
  const { category_id, shape_size_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shape_sizes').delete().eq('category_id', category_id).eq('shape_size_id', shape_size_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
