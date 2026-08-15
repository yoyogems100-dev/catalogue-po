import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { shape_id, size_mm, weight_ct } = await req.json();
  if (!shape_id || !size_mm?.trim()) return NextResponse.json({ error: 'shape_id and size_mm required' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('shape_sizes')
    .insert({ shape_id, size_mm: size_mm.trim(), weight_ct: weight_ct || null })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('shape_sizes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
