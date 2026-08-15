import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { category_id, shape_size_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shape_sizes').insert({ category_id, shape_size_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { category_id, shape_size_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shape_sizes').delete().eq('category_id', category_id).eq('shape_size_id', shape_size_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
