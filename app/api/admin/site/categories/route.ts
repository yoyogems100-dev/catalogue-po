import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, idArray, positiveId, readJson, refreshPublicSite, requireAdmin, slugify } from '@/lib/site/api';

// Create a website category, or save a new order for one level of the tree.

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const name = typeof body?.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 80) : '';
  if (!name) return fail('Give the category a name.');
  const parentId = body?.parent_id == null ? null : positiveId(body.parent_id);
  if (body?.parent_id != null && !parentId) return fail('Choose a valid parent category.');
  const slug = slugify(typeof body?.slug === 'string' && body.slug ? body.slug : name);
  if (!slug) return fail('The name needs at least one letter or number.');

  let siblings = supabaseAdmin.from('site_categories').select('slug, sort_order');
  siblings = parentId ? siblings.eq('parent_id', parentId) : siblings.is('parent_id', null);
  const { data: existing } = await siblings;
  if (existing?.some((c) => c.slug === slug)) return fail(`Another category here already uses the web address "${slug}".`);
  const sort_order = Math.max(0, ...(existing || []).map((c) => c.sort_order)) + 10;

  const { data, error } = await supabaseAdmin.from('site_categories')
    .insert({ name, slug, parent_id: parentId, sort_order, is_visible: false })
    .select('id').single();
  if (error) return fail(error.message.includes('sub-categor') ? 'A sub-category cannot have its own sub-categories.' : error.message);
  refreshPublicSite();
  return NextResponse.json({ id: data.id });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const ids = idArray(body?.ids);
  if (!ids?.length) return fail('Nothing to reorder.');
  const { data: rows } = await supabaseAdmin.from('site_categories').select('id, parent_id').in('id', ids);
  const parents = new Set((rows || []).map((r) => r.parent_id ?? 0));
  if ((rows || []).length !== ids.length || parents.size !== 1) return fail('Categories can only be reordered within the same level.');
  for (const [i, id] of ids.entries()) {
    const { error } = await supabaseAdmin.from('site_categories').update({ sort_order: (i + 1) * 10 }).eq('id', id);
    if (error) return fail(error.message);
  }
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
