import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { isAdminAuthed } from '@/lib/auth';
import { PHOTOS_BUCKET, supabaseAdmin } from '@/lib/supabase-admin';

// Category-only shapes, sizes and materials (colours owned by one category,
// e.g. Semi Precious Beads' Rose Quartz), and which materials each shape/size
// carries. Only rows owned by this category can be renamed or deleted here, so
// nothing on this route can change another category or the shared masters.

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_NAME = 80;

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name && name.length <= MAX_NAME ? name : null;
}

function dbMessage(error: { code?: string; message: string }, what: string) {
  return error.code === '23505' ? `This category already has a ${what} with that name.` : error.message;
}

async function ownedColor(categoryId: number, colorId: number) {
  const { data } = await supabaseAdmin.from('colors').select('id').eq('id', colorId).eq('owner_category_id', categoryId).maybeSingle();
  return !!data;
}

async function ownedShape(categoryId: number, shapeId: number) {
  const { data } = await supabaseAdmin.from('shapes').select('id').eq('id', shapeId).eq('owner_category_id', categoryId).maybeSingle();
  return !!data;
}

async function sizeOfOwnedShape(categoryId: number, sizeId: number) {
  const { data } = await supabaseAdmin.from('shape_sizes').select('id, shapes!inner(owner_category_id)').eq('id', sizeId).eq('shapes.owner_category_id', categoryId).maybeSingle();
  return !!data;
}

async function orderCount(column: 'color_id' | 'shape_id' | 'shape_size_id', ids: number[]) {
  if (!ids.length) return 0;
  const { count } = await supabaseAdmin.from('order_items').select('id', { count: 'exact', head: true }).in(column, ids);
  return count || 0;
}

async function nextSort(table: 'colors' | 'shapes', categoryId: number) {
  const { data } = await supabaseAdmin.from(table).select('sort_order').eq('owner_category_id', categoryId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  return (data?.sort_order ?? -1) + 1;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return fail('Unauthorized', 401);
  const categoryId = Number((await params).id);
  if (!Number.isInteger(categoryId) || categoryId <= 0) return fail('Unknown category.');
  const body = await request.json().catch(() => null);
  if (!body || typeof body.action !== 'string') return fail('Missing action.');
  const id = Number(body.id);

  switch (body.action) {
    case 'add_material': {
      const name = cleanName(body.name);
      if (!name) return fail('Enter a material name.');
      const { data, error } = await supabaseAdmin.from('colors')
        .insert({ name, owner_category_id: categoryId, sort_order: await nextSort('colors', categoryId) })
        .select('id, name, ref_photo_url').single();
      if (error) return fail(dbMessage(error, 'material'));
      const link = await supabaseAdmin.from('category_colors').insert({ category_id: categoryId, color_id: data.id });
      if (link.error) return fail(link.error.message);
      return NextResponse.json({ material: data });
    }
    case 'rename_material': {
      const name = cleanName(body.name);
      if (!name) return fail('Enter a material name.');
      if (!(await ownedColor(categoryId, id))) return fail('Material not found in this category.', 404);
      const { error } = await supabaseAdmin.from('colors').update({ name }).eq('id', id);
      if (error) return fail(dbMessage(error, 'material'));
      return NextResponse.json({ ok: true });
    }
    case 'delete_material': {
      if (!(await ownedColor(categoryId, id))) return fail('Material not found in this category.', 404);
      const used = await orderCount('color_id', [id]);
      if (used) return fail(`Used in ${used} order line${used === 1 ? '' : 's'}, so it can't be deleted. Untick it from every shape instead.`);
      const { error } = await supabaseAdmin.from('colors').delete().eq('id', id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'remove_material_photo': {
      if (!(await ownedColor(categoryId, id))) return fail('Material not found in this category.', 404);
      const { error } = await supabaseAdmin.from('colors').update({ ref_photo_url: null }).eq('id', id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'add_shape': {
      const name = cleanName(body.name);
      if (!name) return fail('Enter a shape name.');
      const iconKey = typeof body.iconKey === 'string' && /^[a-z]{2,20}$/.test(body.iconKey) ? body.iconKey : null;
      const { data, error } = await supabaseAdmin.from('shapes')
        .insert({ name, icon_key: iconKey, owner_category_id: categoryId, sort_order: await nextSort('shapes', categoryId) })
        .select('id').single();
      if (error) return fail(dbMessage(error, 'shape'));
      const link = await supabaseAdmin.from('category_shapes').insert({ category_id: categoryId, shape_id: data.id });
      if (link.error) return fail(link.error.message);
      return NextResponse.json({ id: data.id });
    }
    case 'rename_shape': {
      const name = cleanName(body.name);
      if (!name) return fail('Enter a shape name.');
      if (!(await ownedShape(categoryId, id))) return fail('Shape not found in this category.', 404);
      const { error } = await supabaseAdmin.from('shapes').update({ name }).eq('id', id);
      if (error) return fail(dbMessage(error, 'shape'));
      return NextResponse.json({ ok: true });
    }
    case 'delete_shape': {
      if (!(await ownedShape(categoryId, id))) return fail('Shape not found in this category.', 404);
      const { data: sizes } = await supabaseAdmin.from('shape_sizes').select('id').eq('shape_id', id);
      const used = (await orderCount('shape_id', [id])) + (await orderCount('shape_size_id', (sizes || []).map((s) => s.id)));
      if (used) return fail(`Used in ${used} order line${used === 1 ? '' : 's'}, so it can't be deleted.`);
      // shape_sizes, category_shapes, category_shape_sizes and the material
      // rows all cascade from the shape.
      const { error } = await supabaseAdmin.from('shapes').delete().eq('id', id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'add_size': {
      const sizeMm = cleanName(body.sizeMm)?.replace(/\s*mm$/i, '').replace(/\s*[xX*×]\s*/g, 'x');
      if (!sizeMm || !/^\d+(\.\d+)?(x\d+(\.\d+)?)?$/.test(sizeMm)) return fail('Enter a size like 6 or 8x8.');
      if (!(await ownedShape(categoryId, id))) return fail('Shape not found in this category.', 404);
      const { data: existing } = await supabaseAdmin.from('shape_sizes').select('id').eq('shape_id', id).eq('size_mm', sizeMm).maybeSingle();
      if (existing) return fail(`${sizeMm} mm is already listed for this shape.`);
      const { data, error } = await supabaseAdmin.from('shape_sizes').insert({ shape_id: id, size_mm: sizeMm }).select('id').single();
      if (error) return fail(error.message);
      const link = await supabaseAdmin.from('category_shape_sizes').insert({ category_id: categoryId, shape_size_id: data.id });
      if (link.error) return fail(link.error.message);
      return NextResponse.json({ id: data.id, sizeMm });
    }
    case 'delete_size': {
      if (!(await sizeOfOwnedShape(categoryId, id))) return fail('Size not found in this category.', 404);
      const used = await orderCount('shape_size_id', [id]);
      if (used) return fail(`Used in ${used} order line${used === 1 ? '' : 's'}, so it can't be deleted.`);
      const { error } = await supabaseAdmin.from('shape_sizes').delete().eq('id', id);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'set_availability': {
      // Tick or untick one material for one shape/size.
      const colorId = Number(body.colorId);
      if (!(await sizeOfOwnedShape(categoryId, id)) || !(await ownedColor(categoryId, colorId))) return fail('Not part of this category.', 404);
      const row = { category_id: categoryId, shape_size_id: id, color_id: colorId };
      const { error } = body.on
        ? await supabaseAdmin.from('category_size_colors').upsert(row, { onConflict: 'category_id,shape_size_id,color_id', ignoreDuplicates: true })
        : await supabaseAdmin.from('category_size_colors').delete().match(row);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    case 'set_label': {
      const label = body.label === null || body.label === '' ? null : cleanName(body.label);
      if (body.label && !label) return fail('Keep the label under 40 characters.');
      const { error } = await supabaseAdmin.from('categories').update({ option_label: label }).eq('id', categoryId);
      if (error) return fail(error.message);
      return NextResponse.json({ ok: true });
    }
    default:
      return fail('Unknown action.');
  }
}

// A material's photo: resized like the category shape photos so the small
// dropdown thumbnails never pull a full-size phone picture.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return fail('Unauthorized', 401);
  const categoryId = Number((await params).id);
  const form = await request.formData();
  const colorId = Number(form.get('color_id'));
  const file = form.get('file');
  if (!Number.isInteger(categoryId) || !Number.isInteger(colorId) || !(file instanceof File)) return fail('Material and image are required.');
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type) || file.size > MAX_BYTES) return fail('Use a PNG, WebP or JPEG image smaller than 8 MB.');
  if (!(await ownedColor(categoryId, colorId))) return fail('Material not found in this category.', 404);
  try {
    const bytes = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 30_000_000 })
      .rotate()
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    const storagePath = `material-refs/${categoryId}/${colorId}-${Date.now()}.webp`;
    const uploaded = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(storagePath, bytes, { contentType: 'image/webp', upsert: false });
    if (uploaded.error) throw uploaded.error;
    const { data } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(storagePath);
    const updated = await supabaseAdmin.from('colors').update({ ref_photo_url: data.publicUrl }).eq('id', colorId);
    if (updated.error) throw updated.error;
    return NextResponse.json({ refPhotoUrl: data.publicUrl });
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Could not prepare the image.');
  }
}
