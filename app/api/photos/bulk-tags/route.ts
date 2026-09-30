import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Adds (or removes) the same shapes/sizes/colours/specifications on several
// photos at once, leaving every other tag each photo already has alone --
// unlike /api/photos/update, which replaces one photo's whole list.
//
// POST { photo_ids, mode: 'add' | 'remove', shape_ids?, size_ids?, color_ids?, tag_ids? }
const JUNCTIONS: [field: string, table: string, column: string][] = [
  ['shape_ids', 'photo_shapes', 'shape_id'],
  ['size_ids', 'photo_sizes', 'shape_size_id'],
  ['color_ids', 'photo_colors', 'color_id'],
  ['tag_ids', 'photo_tags', 'tag_id']
];

const ids = (value: unknown): number[] =>
  Array.isArray(value)
    ? Array.from(new Set(value.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0)))
    : [];

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const photoIds = ids(body.photo_ids);
  const mode = body.mode === 'remove' ? 'remove' : 'add';
  if (photoIds.length === 0) return NextResponse.json({ error: 'Pick at least one photo.' }, { status: 400 });
  if (photoIds.length > 1000) return NextResponse.json({ error: 'Too many photos at once.' }, { status: 400 });
  const work = JUNCTIONS.map(([field, table, column]) => ({ table, column, values: ids(body[field]) })).filter((j) => j.values.length);
  if (work.length === 0) return NextResponse.json({ error: 'Choose at least one tag.' }, { status: 400 });

  const errors = (await Promise.all(work.map(async ({ table, column, values }) => {
    if (mode === 'remove') {
      const { error } = await supabaseAdmin.from(table).delete().in('photo_id', photoIds).in(column, values);
      return error?.message ?? null;
    }
    const rows = photoIds.flatMap((photo_id) => values.map((value) => ({ photo_id, [column]: value })));
    const { error } = await supabaseAdmin.from(table).upsert(rows, { onConflict: `photo_id,${column}`, ignoreDuplicates: true });
    return error?.message ?? null;
  }))).filter((e): e is string => e !== null);

  if (errors.length) return NextResponse.json({ error: errors.join('; ') }, { status: 400 });

  // Show the new tags on /po's Explore Photos (and its filters) straight away
  // rather than after the page's 30-second cache.
  const { data: owners } = await supabaseAdmin.from('photos').select('categories(slug)').in('id', photoIds);
  const slugs = new Set((owners || []).map((r: any) => r.categories?.slug).filter(Boolean));
  slugs.forEach((slug) => revalidatePath(`/po/category/${slug}`));
  return NextResponse.json({ ok: true, photos: photoIds.length });
}
