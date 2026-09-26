import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { cleanAnswer, cleanQuestion } from '@/lib/site/faq';

type Context = { params: Promise<{ id: string }> };

/** Earlier wordings of this question, newest first, for undo. */
export async function GET(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { data } = await supabaseAdmin.from('site_revisions').select('id, content, created_at')
    .eq('entity', 'faq').eq('entity_key', String(id)).order('created_at', { ascending: false }).limit(20);
  return NextResponse.json({ revisions: data || [] });
}

export async function PATCH(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body) return fail('Invalid request.');
  const patch: Record<string, unknown> = {};
  if ('question' in body) {
    patch.question = cleanQuestion(body.question);
    if (!patch.question) return fail('The question cannot be empty.');
  }
  if ('answer' in body) patch.answer = cleanAnswer(body.answer);
  if ('is_visible' in body) patch.is_visible = body.is_visible === true;
  if ('question' in patch || 'answer' in patch) {
    // Keep the previous wording so it can be put back.
    const { data: prev } = await supabaseAdmin.from('site_faqs').select('question, answer').eq('id', id).maybeSingle();
    if (prev) await supabaseAdmin.from('site_revisions').insert({ entity: 'faq', entity_key: String(id), content: prev, kind: 'draft' });
  }
  const { error } = await supabaseAdmin.from('site_faqs').update(patch).eq('id', id);
  if (error) return fail(error.message);
  refreshPublicSite();
  return NextResponse.json({ ok: true, ...patch });
}

export async function DELETE(_req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  if (!id) return fail('Invalid request.');
  const { error } = await supabaseAdmin.from('site_faqs').delete().eq('id', id);
  if (error) return fail(error.message);
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
