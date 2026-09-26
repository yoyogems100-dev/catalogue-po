import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { photoUrl } from '@/lib/photos';
import { fail, idArray, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { copyPoPhotos, poPhotosFor } from '@/lib/site/copy-po-photos';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };

/** /po photos this website category could copy, and which are already on it. */
export async function GET(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { photos } = await poPhotosFor(supabaseAdmin, id);
  const ids = photos.map((p) => p.id);
  const [{ data: copies }, { data: onPage }, { data: cats }] = await Promise.all([
    ids.length ? supabaseAdmin.from('site_media').select('id, source_photo_id').in('source_photo_id', ids) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('site_media_links').select('media_id').eq('target_type', 'site_category').eq('target_id', id),
    supabaseAdmin.from('categories').select('id, name').in('id', [...new Set(photos.map((p) => p.category_id))])
  ]);
  const shown = new Set((onPage || []).map((l) => l.media_id));
  const copyOf = new Map((copies || []).map((m: any) => [m.source_photo_id, m.id]));
  const catName = new Map((cats || []).map((c) => [c.id, c.name]));
  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      src: photoUrl(p, 400, 'photo'),
      category: catName.get(p.category_id) || '',
      onPage: copyOf.has(p.id) && shown.has(copyOf.get(p.id))
    }))
  });
}

// Copy up to 12 /po photos per request (each is converted to WebP sizes);
// the browser sends larger selections in batches.
export async function POST(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  const photoIds = idArray(body?.photo_ids, 12);
  if (!id || !photoIds?.length) return fail('Choose up to 12 photos.');
  const result = await copyPoPhotos(supabaseAdmin, id, photoIds);
  if (result.linked) refreshPublicSite();
  return NextResponse.json(result, { status: result.linked || !result.errors.length ? 200 : 400 });
}
