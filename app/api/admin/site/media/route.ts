import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { storeSiteImage } from '@/lib/site/media';

export const runtime = 'nodejs';
export const maxDuration = 60;

const TARGETS = new Set(['site_category', 'color', 'shape', 'size']);

/** List library images, newest first, optionally filtered by text or ids. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  const ids = (req.nextUrl.searchParams.get('ids') || '').split(',').map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 200);
  let query = supabaseAdmin.from('site_media').select('id, storage_path, variants, width, height, alt, tags, created_at').order('created_at', { ascending: false }).limit(300);
  if (ids.length) query = query.in('id', ids);
  else if (q) {
    const safe = q.replace(/[%_,()]/g, ' ');
    query = query.or(`alt.ilike.%${safe}%,tags.cs.{${safe.toLowerCase().replace(/[{}"]/g, '')}}`);
  }
  const { data, error } = await query;
  if (error) return fail(error.message);
  return NextResponse.json({ media: data || [] });
}

// Upload one or more images to the website media library. Each is converted
// to WebP with smaller copies for phones. Optionally assigns them straight to
// a category gallery / colour / shape / size as they land.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const form = await req.formData();
  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (!files.length) return fail('Choose at least one image.');
  if (files.length > 20) return fail('Upload up to 20 images at a time.');
  const targetType = String(form.get('target_type') || '');
  const targetId = positiveId(form.get('target_id'));
  const assign = TARGETS.has(targetType) && targetId ? { target_type: targetType, target_id: targetId } : null;
  const alt = String(form.get('alt') || '').trim().slice(0, 200);

  let nextSort = 0;
  if (assign) {
    const { data } = await supabaseAdmin.from('site_media_links').select('sort_order')
      .eq('target_type', assign.target_type).eq('target_id', assign.target_id).order('sort_order', { ascending: false }).limit(1);
    nextSort = data?.[0]?.sort_order ?? 0;
  }

  const created: any[] = [];
  const errors: string[] = [];
  for (const file of files) {
    const stored = await storeSiteImage(file);
    if ('error' in stored) { errors.push(stored.error); continue; }
    const fallbackAlt = alt || file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
    const { data, error } = await supabaseAdmin.from('site_media')
      .insert({ ...stored, alt: fallbackAlt }).select('id, storage_path, variants, width, height, alt, tags').single();
    if (error) { errors.push(`${file.name}: ${error.message}`); continue; }
    if (assign) {
      nextSort += 10;
      await supabaseAdmin.from('site_media_links').insert({ media_id: data.id, ...assign, sort_order: nextSort });
    }
    created.push(data);
  }
  if (assign) refreshPublicSite();
  return NextResponse.json({ created, errors }, { status: created.length ? 200 : 400 });
}
