import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, readJson, refreshPublicSite, requireAdmin, slugify } from '@/lib/site/api';

type Context = { params: Promise<{ id: string }> };
const FILTER_KEYS = ['shape', 'size', 'colour', 'grade'] as const;

// Structural settings (name, web address, visibility, parent, filters, tile
// image) save immediately. Page text goes through the draft/publish route.
export async function PATCH(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body) return fail('Invalid request.');
  const { data: current } = await supabaseAdmin.from('site_categories').select('id, parent_id, slug').eq('id', id).maybeSingle();
  if (!current) return fail('That category no longer exists.', 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
    if (!name) return fail('The name cannot be empty.');
    patch.name = name;
  }
  if ('descriptor' in body) patch.descriptor = typeof body.descriptor === 'string' ? body.descriptor.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  if ('is_visible' in body) patch.is_visible = body.is_visible === true;
  if ('hero_media_id' in body) patch.hero_media_id = body.hero_media_id == null ? null : positiveId(body.hero_media_id);
  if ('filters' in body && body.filters && typeof body.filters === 'object') {
    patch.filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, body.filters[k] === true]));
  }
  let parentId = current.parent_id as number | null;
  if ('parent_id' in body) {
    parentId = body.parent_id == null ? null : positiveId(body.parent_id);
    if (body.parent_id != null && !parentId) return fail('Choose a valid parent.');
    if (parentId === id) return fail('A category cannot sit inside itself.');
    patch.parent_id = parentId;
  }
  if ('slug' in body || 'parent_id' in body) {
    const slug = 'slug' in body ? slugify(String(body.slug || '')) : current.slug;
    if (!slug) return fail('The web address needs at least one letter or number.');
    let q = supabaseAdmin.from('site_categories').select('id').eq('slug', slug).neq('id', id);
    q = parentId ? q.eq('parent_id', parentId) : q.is('parent_id', null);
    const { data: clash } = await q;
    if (clash?.length) return fail(`Another category here already uses the web address "${slug}".`);
    patch.slug = slug;
  }
  const { error } = await supabaseAdmin.from('site_categories').update(patch).eq('id', id);
  if (error) return fail(/sub-categor/.test(error.message) ? error.message : `Could not save: ${error.message}`);
  refreshPublicSite();
  return NextResponse.json({ ok: true, slug: patch.slug });
}

export async function DELETE(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { count } = await supabaseAdmin.from('site_categories').select('id', { count: 'exact', head: true }).eq('parent_id', id);
  if (count) return fail('Move or delete its sub-categories first.');
  // Only the website page is removed. Catalogue categories, photos and
  // colours it pointed at are untouched.
  await supabaseAdmin.from('site_media_links').delete().eq('target_type', 'site_category').eq('target_id', id);
  const { error } = await supabaseAdmin.from('site_categories').delete().eq('id', id);
  if (error) return fail(error.message);
  await supabaseAdmin.from('site_revisions').delete().eq('entity', 'category').eq('entity_key', String(id));
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
