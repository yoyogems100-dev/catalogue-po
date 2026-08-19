import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { category_id, shape_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shapes').upsert({ category_id, shape_id }, { onConflict: 'category_id,shape_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { category_id, shape_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shapes').delete().eq('category_id', category_id).eq('shape_id', shape_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
