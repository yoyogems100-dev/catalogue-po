import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, PHOTOS_BUCKET } from '@/lib/supabase-admin';

/** Junction tables a photo's tags fan out into, keyed by the form field that
 *  carries them. Set at upload time so a batch can be tagged once as it lands,
 *  instead of every photo being retagged one at a time afterwards. */
const TAG_JUNCTIONS: [field: string, table: string, column: string][] = [
  ['shape_ids', 'photo_shapes', 'shape_id'],
  ['size_ids', 'photo_sizes', 'shape_size_id'],
  ['color_ids', 'photo_colors', 'color_id'],
  ['tag_ids', 'photo_tags', 'tag_id']
];

function idList(formData: FormData, field: string): number[] {
  const raw = formData.get(field);
  if (typeof raw !== 'string' || !raw.trim()) return [];
  return Array.from(new Set(
    raw.split(',').map((part) => Number(part.trim())).filter((n) => Number.isInteger(n) && n > 0)
  ));
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const rawCategoryId = formData.get('category_id');
  // A photo can now land with no category at all. Shoots arrive before anyone
  // has decided which category a stone belongs in, so an uploaded photo waits
  // in the admin "Unassigned" inbox until it's given one, instead of the upload
  // being blocked on a decision the uploader may not be able to make yet.
  const categoryId = typeof rawCategoryId === 'string' && rawCategoryId.trim() ? Number(rawCategoryId) : null;
  // A cover-only upload doesn't need to be a stone in the catalogue -- it's
  // excluded from Explore Photos and the photo count, and is auto-set as
  // this category's thumbnail as soon as it's uploaded.
  const isCoverOnly = formData.get('is_cover_only') === 'true';
  // Joins this upload to an existing photo's group as another angle of the
  // same stone. Groups are one level deep, so attaching to an angle attaches
  // to that angle's lead instead.
  const rawParentId = formData.get('parent_photo_id');
  const requestedParentId = typeof rawParentId === 'string' && rawParentId.trim() ? Number(rawParentId) : null;

  if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });
  if (categoryId !== null && !Number.isInteger(categoryId)) {
    return NextResponse.json({ error: 'category_id must be a category id' }, { status: 400 });
  }
  if (isCoverOnly && categoryId === null) {
    return NextResponse.json({ error: 'A cover photo needs a category.' }, { status: 400 });
  }

  let parentPhotoId: number | null = null;
  if (requestedParentId !== null) {
    if (!Number.isInteger(requestedParentId)) {
      return NextResponse.json({ error: 'parent_photo_id must be a photo id' }, { status: 400 });
    }
    const { data: parent } = await supabaseAdmin
      .from('photos')
      .select('id, parent_photo_id')
      .eq('id', requestedParentId)
      .single();
    if (!parent) return NextResponse.json({ error: 'That group no longer exists.' }, { status: 400 });
    parentPhotoId = (parent as any).parent_photo_id ?? parent.id;
  }

  const ext = file.name.split('.').pop() || 'jpg';
  // Uncategorised photos live under their own prefix rather than a made-up
  // category folder, so the inbox is obvious in Storage too.
  const folder = categoryId === null ? 'unassigned' : String(categoryId);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(PHOTOS_BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data: photo, error: dbError } = await supabaseAdmin
    .from('photos')
    .insert({ category_id: categoryId, storage_path: path, is_cover_only: isCoverOnly, parent_photo_id: parentPhotoId })
    .select()
    .single();

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });

  // Tags are best-effort: the file is already stored and the row already
  // exists, so a bad id in the batch defaults shouldn't fail the upload and
  // leave an orphaned object behind. Whatever didn't stick is reported so the
  // screen can say the photo needs tagging by hand.
  const tagErrors: string[] = [];
  await Promise.all(TAG_JUNCTIONS.map(async ([field, table, column]) => {
    const ids = idList(formData, field);
    if (ids.length === 0) return;
    const { error } = await supabaseAdmin.from(table).insert(ids.map((value) => ({ photo_id: photo.id, [column]: value })));
    if (error) tagErrors.push(`${field}: ${error.message}`);
  }));

  if (isCoverOnly) {
    await supabaseAdmin.from('categories').update({ thumbnail_photo_id: photo.id }).eq('id', categoryId);
  }

  return NextResponse.json(tagErrors.length > 0 ? { ...photo, tagError: tagErrors.join('; ') } : photo);
}
