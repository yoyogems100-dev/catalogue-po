import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, idArray, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';

type Context = { params: Promise<{ id: string }> };

// Replace the ordered list of website images in a category's gallery.
export async function PUT(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  const mediaIds = idArray(body?.media_ids, 300);
  if (!id || !mediaIds) return fail('Invalid request.');
  const { error: delErr } = await supabaseAdmin.from('site_media_links').delete().eq('target_type', 'site_category').eq('target_id', id);
  if (delErr) return fail(delErr.message);
  if (mediaIds.length) {
    const { error } = await supabaseAdmin.from('site_media_links')
      .insert(mediaIds.map((media_id, i) => ({ media_id, target_type: 'site_category', target_id: id, sort_order: (i + 1) * 10 })));
    if (error) return fail(error.message);
  }
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
