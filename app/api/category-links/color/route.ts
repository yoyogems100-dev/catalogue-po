import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { category_id, color_id } = await req.json();
  // upsert + ignoreDuplicates -- re-adding a link that already exists (e.g.
  // applying a palette quick-select where some members are already linked)
  // is a no-op instead of a unique-constraint error, which used to revert
  // that one row's checkbox client-side even though nothing was wrong.
  const { error } = await supabaseAdmin.from('category_colors').upsert({ category_id, color_id }, { onConflict: 'category_id,color_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { category_id, color_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_colors').delete().eq('category_id', category_id).eq('color_id', color_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
