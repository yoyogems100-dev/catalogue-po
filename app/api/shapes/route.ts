import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { THREE_VIEW_KEYS } from '@/lib/three-view';
import { isExistingPhoto } from '@/lib/reuse-options';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { name, icon_key } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  // The drawing picked for it when it was added; none means the generic one.
  if (icon_key != null && !THREE_VIEW_KEYS.includes(icon_key)) return NextResponse.json({ error: 'Unknown drawing.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('shapes').insert({ name: name.trim(), ...(icon_key ? { icon_key } : {}) }).select().single();
  if (error) {
    const message = error.code === '23505' ? 'A shape with this name already exists.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, name } = body;
  // Another drawing, or a photo another shape already has ("Choose existing").
  if ('icon_key' in body) {
    if (!THREE_VIEW_KEYS.includes(body.icon_key)) return NextResponse.json({ error: 'Unknown drawing.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('shapes').update({ icon_key: body.icon_key }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if ('ref_photo_url' in body) {
    if (!(await isExistingPhoto(supabaseAdmin, 'shape', body.ref_photo_url))) return NextResponse.json({ error: 'Choose one of the shape photos already in the catalogue.' }, { status: 400 });
    const { data, error } = await supabaseAdmin.from('shapes').update({ ref_photo_url: body.ref_photo_url }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  // The short code (HS, OS...) printed in WhatsApp order messages; blank clears it.
  if ('short_code' in body) {
    const code = typeof body.short_code === 'string' ? body.short_code.trim().slice(0, 12) : '';
    const { data, error } = await supabaseAdmin.from('shapes').update({ short_code: code || null }).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  }
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('shapes').update({ name: name.trim() }).eq('id', id).select().single();
  if (error) {
    const message = error.code === '23505' ? 'A shape with this name already exists.' : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('shapes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
