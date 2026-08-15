import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { name, is_global, category_id } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const { data: tag, error } = await supabaseAdmin
    .from('tags')
    .insert({ name: name.trim(), is_global: is_global !== false })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // If created from within a category (not global), link it immediately
  if (category_id) {
    await supabaseAdmin.from('category_tags').insert({ category_id, tag_id: tag.id });
  }

  return NextResponse.json(tag);
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('tags').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
