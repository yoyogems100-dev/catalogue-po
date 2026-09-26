import type { SupabaseClient } from '@supabase/supabase-js';
import { photoUrl } from '@/lib/photos';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { storeImageBytes } from './media';

// The website keeps its own copy of every photograph it shows. This copies
// /po catalogue photos into the website image library (site_media), with the
// shape / colour / size tags they carry in /po and the grade of the website
// category's source, and adds them to a website category. After the copy the
// two are independent: removing or deleting either one never touches the other.

export type PoPhoto = {
  id: number; category_id: number; storage_path: string | null; drive_id: string | null;
  photo_crop: any; cover_crop: any; watermarked_path: string | null;
  shape_id: number | null; color_id: number | null; shape_size_id: number | null; sort_order: number | null;
};

const PHOTO_COLS = 'id, category_id, storage_path, drive_id, photo_crop, cover_crop, watermarked_path, shape_id, color_id, shape_size_id, sort_order';

/** /po photos a website category can draw on: the ones its linked catalogue categories show. */
export async function poPhotosFor(db: SupabaseClient, siteCategoryId: number) {
  const { data: sources } = await db.from('site_category_sources')
    .select('category_id, grade_id, color_ids, sort_order').eq('site_category_id', siteCategoryId).order('sort_order');
  const list = (sources || []) as { category_id: number; grade_id: number | null; color_ids: number[] | null }[];
  const catIds = [...new Set(list.map((s) => s.category_id))];
  if (!catIds.length) return { sources: list, photos: [] as PoPhoto[] };
  const { data } = await db.from('photos').select(PHOTO_COLS)
    .in('category_id', catIds).is('parent_photo_id', null).not('storage_path', 'is', null)
    .or('is_cover_only.is.null,is_cover_only.eq.false').order('sort_order').order('id').limit(400);
  // Keep the category order of the sources, then /po's own photo order.
  const rank = new Map(catIds.map((id, i) => [id, i]));
  const photos = ((data || []) as PoPhoto[])
    .filter((p) => {
      const narrowed = list.find((s) => s.category_id === p.category_id)?.color_ids;
      return !(narrowed && p.color_id && !narrowed.includes(p.color_id));
    })
    .sort((a, b) => (rank.get(a.category_id)! - rank.get(b.category_id)!));
  return { sources: list, photos };
}

type Result = { copied: number; reused: number; linked: number; errors: string[] };

/**
 * Copy the given /po photos into the website and add them to the end of a
 * website category's photos. A photo already copied before is reused, not
 * copied twice. Photos already on the category are skipped.
 */
export async function copyPoPhotos(db: SupabaseClient, siteCategoryId: number, photoIds: number[], opts: { dryRun?: boolean } = {}): Promise<Result> {
  const out: Result = { copied: 0, reused: 0, linked: 0, errors: [] };
  if (!photoIds.length) return out;
  const { sources } = await poPhotosFor(db, siteCategoryId);
  const { data: rows } = await db.from('photos').select(PHOTO_COLS).in('id', photoIds);
  const byId = new Map(((rows || []) as PoPhoto[]).map((p) => [p.id, p]));
  const photos = photoIds.map((id) => byId.get(id)).filter(Boolean) as PoPhoto[];

  const ids = photos.map((p) => p.id);
  const [{ data: existing }, pShapes, pColors, pSizes, { data: onPage }, { data: last }] = await Promise.all([
    db.from('site_media').select('id, source_photo_id').in('source_photo_id', ids),
    db.from('photo_shapes').select('photo_id, shape_id').in('photo_id', ids),
    db.from('photo_colors').select('photo_id, color_id').in('photo_id', ids),
    db.from('photo_sizes').select('photo_id, shape_size_id').in('photo_id', ids),
    db.from('site_media_links').select('media_id').eq('target_type', 'site_category').eq('target_id', siteCategoryId),
    db.from('site_media_links').select('sort_order').eq('target_type', 'site_category').eq('target_id', siteCategoryId)
      .order('sort_order', { ascending: false }).limit(1)
  ]);
  const copyOf = new Map((existing || []).map((m: any) => [m.source_photo_id as number, m.id as number]));
  const already = new Set((onPage || []).map((l: any) => l.media_id as number));
  let sort = (last?.[0]?.sort_order as number | undefined) ?? 0;

  // Names for the description ("Red Round Ruby Corundum, 3mm").
  const catIds = [...new Set(photos.map((p) => p.category_id))];
  const tagged = (rows: any[] | null, key: string, id: number) => (rows || []).filter((r) => r.photo_id === id).map((r) => r[key] as number);
  const tagsOf = (p: PoPhoto) => ({
    shape: [...new Set([p.shape_id, ...tagged(pShapes.data, 'shape_id', p.id)].filter(Boolean) as number[])],
    color: [...new Set([p.color_id, ...tagged(pColors.data, 'color_id', p.id)].filter(Boolean) as number[])],
    size: [...new Set([p.shape_size_id, ...tagged(pSizes.data, 'shape_size_id', p.id)].filter(Boolean) as number[])]
  });
  const all = photos.map(tagsOf);
  const [{ data: cats }, { data: shapes }, { data: colors }, sizes] = await Promise.all([
    catIds.length ? db.from('categories').select('id, name').in('id', catIds) : Promise.resolve({ data: [] as any[] }),
    db.from('shapes').select('id, name').in('id', [...new Set(all.flatMap((t) => t.shape))]),
    db.from('colors').select('id, name').in('id', [...new Set(all.flatMap((t) => t.color))]),
    fetchAllRows<any>((f, t) => db.from('shape_sizes').select('id, size_mm', { count: 'exact' }).in('id', [...new Set(all.flatMap((x) => x.size))]).range(f, t))
  ]);
  const name = (list: any[] | null | undefined, id: number | undefined, key = 'name') => (list || []).find((r) => r.id === id)?.[key] as string | undefined;

  for (const p of photos) {
    let mediaId = copyOf.get(p.id);
    if (mediaId && already.has(mediaId)) continue;
    if (mediaId) out.reused++;
    else {
      const tags = tagsOf(p);
      const size = name(sizes.data, tags.size[0], 'size_mm');
      const alt = ([name(colors, tags.color[0]), name(shapes, tags.shape[0]), name(cats, p.category_id)].filter(Boolean).join(' ') + (size ? `, ${size}mm` : '')).slice(0, 200);
      if (opts.dryRun) { out.copied++; out.linked++; copyOf.set(p.id, -p.id); continue; }
      const src = photoUrl(p, 2400, 'photo');
      if (!src) { out.errors.push(`Photo ${p.id}: no file.`); continue; }
      let bytes: Buffer;
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        bytes = Buffer.from(await res.arrayBuffer());
      } catch (e: any) {
        out.errors.push(`Photo ${p.id}: could not download (${e.message}).`);
        continue;
      }
      const stored = await storeImageBytes(db, bytes, `Photo ${p.id}`);
      if ('error' in stored) { out.errors.push(stored.error); continue; }
      const { data: media, error } = await db.from('site_media')
        .insert({ ...stored, alt, source_photo_id: p.id }).select('id').single();
      if (error || !media) { out.errors.push(`Photo ${p.id}: ${error?.message || 'not saved'}.`); continue; }
      mediaId = media.id as number;
      copyOf.set(p.id, mediaId);
      const grade = sources.find((s) => s.category_id === p.category_id)?.grade_id;
      const tagLinks = [
        ...tags.shape.map((id) => ({ target_type: 'shape', target_id: id })),
        ...tags.color.map((id) => ({ target_type: 'color', target_id: id })),
        ...tags.size.map((id) => ({ target_type: 'size', target_id: id })),
        ...(grade ? [{ target_type: 'grade', target_id: grade }] : [])
      ].map((l) => ({ media_id: mediaId, ...l, sort_order: 0 }));
      if (tagLinks.length) {
        const { error: tagErr } = await db.from('site_media_links').upsert(tagLinks, { onConflict: 'media_id,target_type,target_id', ignoreDuplicates: true });
        if (tagErr) out.errors.push(`Photo ${p.id}: tags not saved (${tagErr.message}).`);
      }
      out.copied++;
    }
    if (opts.dryRun) { out.linked++; continue; }
    sort += 10;
    const { error: linkErr } = await db.from('site_media_links')
      .upsert({ media_id: mediaId, target_type: 'site_category', target_id: siteCategoryId, sort_order: sort }, { onConflict: 'media_id,target_type,target_id', ignoreDuplicates: true });
    if (linkErr) out.errors.push(`Photo ${p.id}: not added to the category (${linkErr.message}).`);
    else { out.linked++; already.add(mediaId); }
  }
  return out;
}
