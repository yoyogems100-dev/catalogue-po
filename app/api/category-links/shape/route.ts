import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { category_id, shape_id } = await req.json();
  const { error } = await supabaseAdmin.from('category_shapes').upsert({ category_id, shape_id }, { onConflict: 'category_id,shape_id', ignoreDuplicates: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { category_id, shape_id } = await req.json();

  // Unlinking a shape must also drop this category's links to that shape's
  // sizes -- otherwise they're orphaned: still selectable in "all shapes" size
  // lists, and silently reappear pre-enabled if the shape is ever re-linked.
  const { data: sizesForShape } = await supabaseAdmin.from('shape_sizes').select('id').eq('shape_id', shape_id);
  const sizeIds = (sizesForShape || []).map((s) => s.id);
  if (sizeIds.length) {
    const { error: sizesError } = await supabaseAdmin.from('category_shape_sizes').delete().eq('category_id', category_id).in('shape_size_id', sizeIds);
    if (sizesError) return NextResponse.json({ error: sizesError.message }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('category_shapes').delete().eq('category_id', category_id).eq('shape_id', shape_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { category_id, shape_id, reference_style } = await req.json();
  if (!Number.isInteger(category_id) || !Number.isInteger(shape_id)) {
    return NextResponse.json({ error: 'Category and shape are required.' }, { status: 400 });
  }
  if (!['vector', 'photo'].includes(reference_style)) return NextResponse.json({ error: 'Invalid reference style.' }, { status: 400 });
  const { data: link, error: linkError } = await supabaseAdmin
    .from('category_shapes')
    .select('shape_id,ref_photo_url')
    .eq('category_id', category_id)
    .eq('shape_id', shape_id)
    .maybeSingle();
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
  if (!link) return NextResponse.json({ error: 'This shape is not linked to the category.' }, { status: 404 });
  if (reference_style === 'photo' && !link.ref_photo_url) {
    return NextResponse.json({ error: 'Upload a gemstone photo before selecting it.' }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from('category_shapes').update({ reference_style }).eq('category_id', category_id).eq('shape_id', shape_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
