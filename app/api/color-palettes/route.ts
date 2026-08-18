import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  const [{ data: palettes }, { data: items }] = await Promise.all([
    supabaseAdmin.from('color_palettes').select('id, name').order('sort_order').order('name'),
    supabaseAdmin.from('color_palette_items').select('palette_id, color_id')
  ]);
  const byPalette: Record<number, number[]> = {};
  (items || []).forEach((i: any) => {
    if (!byPalette[i.palette_id]) byPalette[i.palette_id] = [];
    byPalette[i.palette_id].push(i.color_id);
  });
  const result = (palettes || []).map((p: any) => ({ id: p.id, name: p.name, colorIds: byPalette[p.id] || [] }));
  return NextResponse.json({ palettes: result });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('color_palettes').insert({ name: name.trim() }).select().single();
  if (error) {
    const message = error.code === '23505' ? 'A palette with this name already exists.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!isAdminAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('color_palettes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
