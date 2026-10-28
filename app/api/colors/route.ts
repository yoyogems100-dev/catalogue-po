import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isExistingPhoto } from '@/lib/reuse-options';
import { catalogueChanged } from '@/lib/catalogue-cache';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  catalogueChanged();
  const { name, hex_value } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from('colors')
    .insert({ name: name.trim(), hex_value: hex_value || '#B0AFAC' })
    .select()
    .single();
  if (error) {
    const message = error.code === '23505' ? 'A color with this name already exists.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  catalogueChanged();
  const { id, hex_value, name, ref_photo_url } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const updates: Record<string, string> = {};
  // A photo another colour already has ("Choose existing").
  if (ref_photo_url !== undefined) {
    if (!(await isExistingPhoto(supabaseAdmin, 'colour', ref_photo_url))) return NextResponse.json({ error: 'Choose one of the colour photos already in the catalogue.' }, { status: 400 });
    updates.ref_photo_url = ref_photo_url;
  }
  if (hex_value) updates.hex_value = hex_value;
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    updates.name = name.trim();
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  const { error } = await supabaseAdmin.from('colors').update(updates).eq('id', id);
  if (error) {
    const message = error.code === '23505' ? 'A color with this name already exists.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  catalogueChanged();
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('colors').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
