import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { PHOTOS_BUCKET, supabaseAdmin } from '@/lib/supabase-admin';
import { ORIGINALS_BUCKET, uploadWatermarked, uprightOriginal, watermarkedVariant } from '@/lib/photo-files';
import { BACKDROPS, cleanHoles, drilledCutout, inLightBox, type Backdrop } from '@/lib/drill-hole';
import { DRILLED_CATEGORY_ID } from '@/lib/order-specs';
import { holesLabel, readDrill, type DrillRecord, type HoleCount } from '@/lib/drill-data';

export const runtime = 'nodejs';

/** The photo to drill into, read only from this site or our own Storage. */
async function loadBase(base: string, origin: string): Promise<Buffer> {
  let url: URL;
  if (base.startsWith('/') && !base.startsWith('//') && !base.includes('..')) url = new URL(base, origin);
  else {
    url = new URL(base);
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) throw new Error('That photo is not one of ours.');
  }
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the gemstone photo.');
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Drill holes into a Hole Punched shape's gemstone photo.
 * { shape_id, holes, backdrop, preview? }
 *  - preview: renders and returns both pictures, saves nothing.
 *  - otherwise: it's saved as the shape's photo for that many holes (1, 2 or
 *    3) -- what a customer sees in the dropdown, cart and checkout after
 *    choosing that many holes; the 1-hole photo is also the shape's usual
 *    photo here. The stone in its light box is added to the category's explore
 *    photos, tagged with the shape, or replaces the one an earlier save of the
 *    same hole count added.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number((await params).id);
  if (categoryId !== DRILLED_CATEGORY_ID) return NextResponse.json({ error: 'Drill holes are for Hole Punched Stones only.' }, { status: 400 });
  const body = await request.json().catch(() => null);
  const shapeId = Number(body?.shape_id);
  const holes = cleanHoles(body?.holes);
  const backdrop = body?.backdrop as Backdrop;
  if (!Number.isInteger(shapeId) || !holes || !BACKDROPS.includes(backdrop)) {
    return NextResponse.json({ error: 'Choose a shape, 1 to 3 holes and a black or white backdrop.' }, { status: 400 });
  }

  const [{ data: link, error: linkError }, { data: shape }] = await Promise.all([
    supabaseAdmin.from('category_shapes').select('ref_photo_url, drill').eq('category_id', categoryId).eq('shape_id', shapeId).maybeSingle()
      .then(async (r) => {
        if (r.error?.code !== '42703') return r;
        // Before the drill migration: previews still work, saving waits for it.
        if (!body?.preview) return { data: null, error: { message: 'Saving needs the database update for drill holes. Preview still works.' } } as unknown as typeof r;
        return await supabaseAdmin.from('category_shapes').select('ref_photo_url').eq('category_id', categoryId).eq('shape_id', shapeId).maybeSingle() as unknown as typeof r;
      }),
    supabaseAdmin.from('shapes').select('name, ref_photo_url').eq('id', shapeId).maybeSingle()
  ]);
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 400 });
  if (!link || !shape) return NextResponse.json({ error: 'This shape is not in Hole Punched Stones.' }, { status: 404 });
  const previous = readDrill((link as any).drill, (link as any).ref_photo_url);
  const count = holes.length as HoleCount;
  // Holes are always drilled into the clean photo, so moving or erasing one
  // never leaves an old hole behind: the photo of the first drilling, else a
  // photo uploaded for this shape in this category, else the shape's own
  // gemstone photo.
  const uploaded = (link as any).ref_photo_url?.includes('/shape-references/') ? (link as any).ref_photo_url : null;
  const base: string | null = previous?.base || uploaded || (shape as any).ref_photo_url || (link as any).ref_photo_url;
  if (!base) return NextResponse.json({ error: 'Add a gemstone photo for this shape first.' }, { status: 400 });

  let cutout: Buffer, boxed: Buffer;
  try {
    cutout = await drilledCutout(await loadBase(base, request.nextUrl.origin), holes);
    boxed = await inLightBox(cutout, backdrop, shapeId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not drill this photo.' }, { status: 400 });
  }
  if (body?.preview) {
    return NextResponse.json({
      cutout: `data:image/webp;base64,${cutout.toString('base64')}`,
      lightBox: `data:image/jpeg;base64,${(await watermarkedVariant(await uprightOriginal(boxed))).toString('base64')}`
    });
  }

  const stamp = `${shapeId}-${Date.now()}`;
  const created: [bucket: string, path: string][] = [];
  const cleanUp = () => Promise.all(created.map(([bucket, path]) => supabaseAdmin.storage.from(bucket).remove([path])));
  try {
    const cutoutPath = `shape-references/${categoryId}/drilled-${stamp}.webp`;
    const up = await supabaseAdmin.storage.from(PHOTOS_BUCKET).upload(cutoutPath, cutout, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' });
    if (up.error) throw up.error;
    created.push([PHOTOS_BUCKET, cutoutPath]);

    // The explore photo goes the way every upload does: clean original kept
    // privately, watermarked copy shown.
    const originalPath = `${categoryId}/drilled-${stamp}.jpg`;
    const orig = await supabaseAdmin.storage.from(ORIGINALS_BUCKET).upload(originalPath, boxed, { contentType: 'image/jpeg', upsert: false });
    if (orig.error) throw orig.error;
    created.push([ORIGINALS_BUCKET, originalPath]);
    const storagePath = await uploadWatermarked(supabaseAdmin, { category_id: categoryId }, await watermarkedVariant(await uprightOriginal(boxed)), 'photo');
    created.push([PHOTOS_BUCKET, storagePath]);

    let photoId = previous?.variants[`${count}`]?.photoId ?? null;
    const existing = photoId
      ? (await supabaseAdmin.from('photos').select('id').eq('id', photoId).eq('category_id', categoryId).maybeSingle()).data
      : null;
    if (existing) {
      // Its crops were of the old picture; they'd show the old holes.
      const updated = await supabaseAdmin.from('photos')
        .update({ storage_path: storagePath, original_path: originalPath, photo_crop: null, cover_crop: null })
        .eq('id', photoId!);
      if (updated.error) throw updated.error;
    } else {
      const inserted = await supabaseAdmin.from('photos')
        .insert({ category_id: categoryId, storage_path: storagePath, original_path: originalPath, notes: `${(shape as any).name}, ${holesLabel(count)} drilled` })
        .select('id').single();
      if (inserted.error) throw inserted.error;
      photoId = inserted.data.id;
      const tagged = await supabaseAdmin.from('photo_shapes').insert({ photo_id: photoId, shape_id: shapeId });
      if (tagged.error) throw tagged.error;
    }

    const { data: pub } = supabaseAdmin.storage.from(PHOTOS_BUCKET).getPublicUrl(cutoutPath);
    const drill: DrillRecord = { base, variants: { ...previous?.variants, [`${count}`]: { holes, backdrop, photoId, url: pub.publicUrl } } };
    const saved = await supabaseAdmin.from('category_shapes')
      .update(count === 1 ? { ref_photo_url: pub.publicUrl, reference_style: 'photo', drill } : { drill })
      .eq('category_id', categoryId).eq('shape_id', shapeId);
    if (saved.error) throw saved.error;
    return NextResponse.json({ refPhotoUrl: pub.publicUrl, drill });
  } catch (error) {
    await cleanUp();
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save the drilled photo.' }, { status: 400 });
  }
}
