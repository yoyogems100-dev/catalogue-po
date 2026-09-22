import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

function toWatermark(w: any) {
  return {
    id: w.id,
    name: w.name,
    opacity: Number(w.opacity),
    text: w.text || null,
    color: w.color || null,
    // Null for a typed watermark -- it is drawn on demand, not stored as a file.
    url: w.storage_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PHOTOS_BUCKET}/${w.storage_path}` : null
  };
}

export async function GET() {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabaseAdmin.from('watermarks').select('*').order('sort_order').order('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ watermarks: (data || []).map(toWatermark) });
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Typed watermarks arrive as JSON, uploaded ones as multipart. Uploading is
  // still supported for a logo mark that isn't text at all.
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const body = await req.json();
    const name = String(body.name || '').trim();
    const text = String(body.text || '').trim();
    const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color)) ? String(body.color) : '#ffffff';
    const opacity = Math.min(1, Math.max(0.05, Number(body.opacity) || 0.5));
    if (!text) return NextResponse.json({ error: 'Enter the watermark text.' }, { status: 400 });

    // The text doubles as the name when none is given -- one less field to
    // fill in for the common case of watermarking with your own name.
    const { data, error } = await supabaseAdmin.from('watermarks').insert({ name: name || text, text, color, opacity }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: data.id });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const name = String(formData.get('name') || '').trim();
  const opacity = Math.min(1, Math.max(0.05, Number(formData.get('opacity')) || 0.5));

  if (!file || !name) return NextResponse.json({ error: 'A name and an image are required.' }, { status: 400 });

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `watermarks/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(path, arrayBuffer, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('watermarks').insert({ name, storage_path: path, opacity }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.id });
}
