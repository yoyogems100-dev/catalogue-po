import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { catalogueChanged } from '@/lib/catalogue-cache';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { ROUND_SIZE_MESSAGE, sizeFitsShape } from '@/lib/shape-size-fit';
import { sameSizeKey } from '@/lib/size-label';
import { createSharedColor } from '@/lib/create-color';

// "+ Add" in the admin order builder: a shape, colour or size the buyer asked
// for that this category doesn't list yet.
//
// GET lists what can be added -- master shapes/colours not linked to the
// category, or every size of the chosen shapes (with which are linked).
// POST links them. Only category join rows are written, plus a new master
// size when the shape has never had that size, or a new shared colour the
// catalogue has never had ("new-color"); nothing is ever removed.

const ids = (raw: string | null) => (raw || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0);

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number((await params).id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return NextResponse.json({ error: 'Bad category' }, { status: 400 });
  const kind = req.nextUrl.searchParams.get('kind');

  if (kind === 'shape') {
    const [{ data: shapes }, { data: links }] = await Promise.all([
      supabaseAdmin.from('shapes').select('id, name, icon_key, ref_photo_url').order('sort_order').order('name'),
      supabaseAdmin.from('category_shapes').select('shape_id').eq('category_id', categoryId)
    ]);
    const linked = new Set((links || []).map((l: any) => l.shape_id));
    return NextResponse.json({
      shapes: (shapes || []).filter((s: any) => !linked.has(s.id)).map((s: any) => ({ id: s.id, name: s.name, iconKey: s.icon_key, refPhotoUrl: s.ref_photo_url }))
    });
  }

  if (kind === 'color') {
    const [colors, links] = await Promise.all([
      fetchAllRows<any>((f, t) => supabaseAdmin.from('colors').select('id, name, hex_value, ref_photo_url', { count: 'exact' }).order('sort_order').order('name').range(f, t)),
      fetchAllRows<any>((f, t) => supabaseAdmin.from('category_colors').select('color_id', { count: 'exact' }).eq('category_id', categoryId).range(f, t))
    ]);
    const linked = new Set((links.data || []).map((l: any) => l.color_id));
    return NextResponse.json({
      colors: (colors.data || []).filter((c: any) => !linked.has(c.id)).map((c: any) => ({ id: c.id, name: c.name, hex: c.hex_value, refPhotoUrl: c.ref_photo_url }))
    });
  }

  if (kind === 'size') {
    const shapeIds = ids(req.nextUrl.searchParams.get('shapeIds'));
    if (!shapeIds.length) return NextResponse.json({ sizes: [] });
    const [{ data: shapes }, sizes, links] = await Promise.all([
      supabaseAdmin.from('shapes').select('id, name').in('id', shapeIds),
      fetchAllRows<any>((f, t) => supabaseAdmin.from('shape_sizes').select('id, shape_id, size_mm', { count: 'exact' }).in('shape_id', shapeIds).order('id').range(f, t)),
      fetchAllRows<any>((f, t) => supabaseAdmin.from('category_shape_sizes').select('shape_size_id', { count: 'exact' }).eq('category_id', categoryId).range(f, t))
    ]);
    const nameOf = new Map((shapes || []).map((s: any) => [s.id, s.name]));
    const linked = new Set((links.data || []).map((l: any) => l.shape_size_id));
    // One row per shape and size: "3", "3.0" and "3x3" under one square are the same stone.
    const byKey = new Map<string, { id: number; shapeId: number; sizeMm: string; linked: boolean }>();
    for (const s of sizes.data || []) {
      if (!sizeFitsShape(nameOf.get(s.shape_id), s.size_mm)) continue;
      const key = `${s.shape_id}:${sameSizeKey(s.size_mm)}`;
      const row = { id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm, linked: linked.has(s.id) };
      const prev = byKey.get(key);
      if (!prev || (row.linked && !prev.linked)) byKey.set(key, row);
    }
    return NextResponse.json({ sizes: [...byKey.values()] });
  }

  return NextResponse.json({ error: 'kind must be shape, color or size' }, { status: 400 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number((await params).id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return NextResponse.json({ error: 'Bad category' }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const kind = body?.kind;

  if (kind === 'shape' || kind === 'color') {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: `Pick a ${kind}.` }, { status: 400 });
    const table = kind === 'shape' ? 'category_shapes' : 'category_colors';
    const column = kind === 'shape' ? 'shape_id' : 'color_id';
    const { error } = await supabaseAdmin.from(table).upsert({ category_id: categoryId, [column]: id }, { onConflict: `category_id,${column}`, ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    catalogueChanged();
    return NextResponse.json({ ok: true, id });
  }

  if (kind === 'size') {
    const shapeId = Number(body.shapeId);
    const sizeMm = String(body.sizeMm || '').trim().replace(/\s*mm\s*$/i, '').replace(/\s*[×*X]\s*/g, 'x');
    if (!Number.isInteger(shapeId) || shapeId <= 0) return NextResponse.json({ error: 'Pick a shape first.' }, { status: 400 });
    if (!/^\d+(?:\.\d+)?(?:x\d+(?:\.\d+)?){0,2}$/.test(sizeMm)) return NextResponse.json({ error: 'Type a size like 2.5 or 6x8.' }, { status: 400 });
    const [{ data: shape }, { data: existing }] = await Promise.all([
      supabaseAdmin.from('shapes').select('id, name').eq('id', shapeId).maybeSingle(),
      supabaseAdmin.from('shape_sizes').select('id, size_mm').eq('shape_id', shapeId)
    ]);
    if (!shape) return NextResponse.json({ error: 'Shape not found.' }, { status: 404 });
    if (!sizeFitsShape(shape.name, sizeMm)) return NextResponse.json({ error: ROUND_SIZE_MESSAGE }, { status: 400 });

    // The shape may already have this size under another spelling ("2.50" for
    // "2.5", "3x3" for "3") -- link that one rather than make a twin.
    const key = sameSizeKey(sizeMm);
    let sizeId: number | undefined = (existing || []).find((s: any) => sameSizeKey(s.size_mm) === key)?.id;
    let created = false;
    if (!sizeId) {
      const { data: inserted, error } = await supabaseAdmin.from('shape_sizes').insert({ shape_id: shapeId, size_mm: sizeMm }).select('id').single();
      if (error || !inserted) return NextResponse.json({ error: error?.message || 'Could not add the size.' }, { status: 400 });
      sizeId = inserted.id as number;
      created = true;
    }
    // A size only shows once its shape is on the category too.
    const [{ error: shapeError }, { error: sizeError }] = await Promise.all([
      supabaseAdmin.from('category_shapes').upsert({ category_id: categoryId, shape_id: shapeId }, { onConflict: 'category_id,shape_id', ignoreDuplicates: true }),
      supabaseAdmin.from('category_shape_sizes').upsert({ category_id: categoryId, shape_size_id: sizeId }, { onConflict: 'category_id,shape_size_id', ignoreDuplicates: true })
    ]);
    if (shapeError || sizeError) return NextResponse.json({ error: (shapeError || sizeError)!.message }, { status: 400 });
    catalogueChanged();
    return NextResponse.json({ ok: true, id: sizeId, created });
  }

  // A colour the catalogue has never had: made as a shared master colour
  // (same as Admin > Colors' "Add") and linked to this category only. A
  // shared colour of the same name is linked instead of making a twin.
  if (kind === 'new-color') {
    const color = await createSharedColor(body.name, body.hex, { reuseSameName: true });
    if ('error' in color) return NextResponse.json({ error: color.error }, { status: color.status });
    const { error } = await supabaseAdmin.from('category_colors').upsert({ category_id: categoryId, color_id: color.id }, { onConflict: 'category_id,color_id', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: `${color.created ? 'Colour made' : 'Colour found'}, but it could not be linked to this category: ${error.message}` }, { status: 400 });
    catalogueChanged();
    return NextResponse.json({ ok: true, id: color.id, name: color.name, created: color.created });
  }

  return NextResponse.json({ error: 'kind must be shape, color, new-color or size' }, { status: 400 });
}
