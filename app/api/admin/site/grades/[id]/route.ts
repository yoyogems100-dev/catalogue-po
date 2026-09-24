import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { cleanContent } from '@/lib/site/schema';
import { gradeSchema } from '@/lib/site/schemas';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body) return fail('Invalid request.');
  const patch: Record<string, unknown> = {};
  if ('name' in body) {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (!name) return fail('The name cannot be empty.');
    patch.name = name;
  }
  if ('is_visible' in body) patch.is_visible = body.is_visible === true;
  if ('summary' in body || 'description' in body) {
    const { main } = cleanContent(gradeSchema, { main: { summary: body.summary, description: body.description } });
    if ('summary' in body) patch.summary = main.summary;
    if ('description' in body) patch.description = main.description;
    // Keep a history of the text so it can be undone like page text.
    const { data: prev } = await supabaseAdmin.from('site_grades').select('summary, description').eq('id', id).maybeSingle();
    if (prev) await supabaseAdmin.from('site_revisions').insert({ entity: 'grade', entity_key: String(id), content: prev, kind: 'draft' });
  }
  const { error } = await supabaseAdmin.from('site_grades').update(patch).eq('id', id);
  if (error) return fail(error.message);
  refreshPublicSite();
  return NextResponse.json({ ok: true, ...patch });
}

export async function DELETE(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { error } = await supabaseAdmin.from('site_grades').delete().eq('id', id);
  if (error) return fail(error.message);
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
