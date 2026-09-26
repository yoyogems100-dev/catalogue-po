import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { removeStoredFiles, storeSiteImage } from '@/lib/site/media';

export const runtime = 'nodejs';
export const maxDuration = 60;
type Context = { params: Promise<{ id: string }> };
const TARGETS = new Set(['site_category', 'color', 'shape', 'size']);

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((t) => String(t).replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 40)).filter(Boolean))].slice(0, 20);
}

/** Alt text, tags, and which categories / colours / shapes / sizes use it. */
export async function PATCH(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body) return fail('Invalid request.');
  const patch: Record<string, unknown> = {};
  if ('alt' in body) patch.alt = String(body.alt || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if ('tags' in body) patch.tags = cleanTags(body.tags);
  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from('site_media').update(patch).eq('id', id);
    if (error) return fail(error.message);
  }
  if (Array.isArray(body.links)) {
    const links = [];
    for (const l of body.links) {
      const target_id = positiveId(l?.target_id);
      if (!TARGETS.has(l?.target_type) || !target_id) return fail('Invalid assignment.');
      links.push({ target_type: l.target_type as string, target_id });
    }
    const { data: existing } = await supabaseAdmin.from('site_media_links').select('target_type, target_id').eq('media_id', id);
    const key = (l: { target_type: string; target_id: number }) => `${l.target_type}:${l.target_id}`;
    const want = new Set(links.map(key));
    const have = new Set((existing || []).map(key));
    for (const l of existing || []) {
      if (!want.has(key(l))) await supabaseAdmin.from('site_media_links').delete().eq('media_id', id).eq('target_type', l.target_type).eq('target_id', l.target_id);
    }
    for (const l of links) {
      if (have.has(key(l))) continue;
      const { data: last } = await supabaseAdmin.from('site_media_links').select('sort_order')
        .eq('target_type', l.target_type).eq('target_id', l.target_id).order('sort_order', { ascending: false }).limit(1);
      await supabaseAdmin.from('site_media_links').insert({ media_id: id, ...l, sort_order: (last?.[0]?.sort_order ?? 0) + 10 });
    }
  }
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}

/** Replace the image file but keep its id, alt text and every place it is used. */
export async function POST(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { data: current } = await supabaseAdmin.from('site_media').select('storage_path, variants').eq('id', id).maybeSingle();
  if (!current) return fail('That image no longer exists.', 404);
  const file = (await req.formData()).get('file');
  if (!(file instanceof File)) return fail('Choose an image.');
  const stored = await storeSiteImage(file);
  if ('error' in stored) return fail(stored.error);
  const { data, error } = await supabaseAdmin.from('site_media').update(stored).eq('id', id).select('id, storage_path, variants, width, height, alt, tags').single();
  if (error) { await removeStoredFiles(stored); return fail(error.message); }
  await removeStoredFiles(current as any);
  refreshPublicSite();
  return NextResponse.json({ media: data });
}

export async function DELETE(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { data: current } = await supabaseAdmin.from('site_media').select('storage_path, variants').eq('id', id).maybeSingle();
  if (!current) return NextResponse.json({ ok: true });
  // Page text can reference an image by id; those references simply stop
  // showing an image rather than breaking the page.
  const { error } = await supabaseAdmin.from('site_media').delete().eq('id', id);
  if (error) return fail(error.message);
  await removeStoredFiles(current as any);
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
