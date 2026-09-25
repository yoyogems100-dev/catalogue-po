import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Materials sit above categories (Ruby over Ruby Corundum, Ruby Chatham...).
// Create, rename, reorder and delete. Deleting a material only removes it and
// its category links; the categories themselves are never touched.
function cleanName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ').slice(0, 80) : '';
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  const clean = cleanName(name);
  if (!clean) return NextResponse.json({ error: 'Give the material a name.' }, { status: 400 });
  const { data: last } = await supabaseAdmin.from('materials').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from('materials').insert({ name: clean, sort_order: (last?.sort_order ?? 0) + 1 }).select('id, name, sort_order').single();
  if (error) return NextResponse.json({ error: error.code === '23505' ? `There is already a material called ${clean}.` : error.message }, { status: 400 });
  return NextResponse.json({ material: data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  if (Array.isArray(body.order)) {
    const ids = body.order.map(Number).filter((n: number) => Number.isSafeInteger(n) && n > 0);
    for (const [index, id] of ids.entries()) {
      const { error } = await supabaseAdmin.from('materials').update({ sort_order: index + 1 }).eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }
  const id = Number(body.id);
  const clean = cleanName(body.name);
  if (!Number.isSafeInteger(id) || !clean) return NextResponse.json({ error: 'Material and name are required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('materials').update({ name: clean }).eq('id', id);
  if (error) return NextResponse.json({ error: error.code === '23505' ? `There is already a material called ${clean}.` : error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await req.json()).id);
  if (!Number.isSafeInteger(id)) return NextResponse.json({ error: 'Material is required.' }, { status: 400 });
  const { error } = await supabaseAdmin.from('materials').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
