import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, idArray, positiveId, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';

type Context = { params: Promise<{ id: string }> };

// Replace which catalogue categories feed this website page, and which grades
// apply to it. Sent as the full list each time, so the screen is the truth.
export async function PUT(req: NextRequest, context: Context) {
  const denied = await requireAdmin(); if (denied) return denied;
  const id = positiveId((await context.params).id);
  const body = await readJson(req);
  if (!id || !body || !Array.isArray(body.sources)) return fail('Invalid request.');
  const gradeIds = idArray(body.grade_ids ?? [], 50);
  if (!gradeIds) return fail('Invalid grades.');

  const sources = [];
  for (const [i, s] of (body.sources as any[]).entries()) {
    const category_id = positiveId(s?.category_id);
    if (!category_id) return fail('Invalid catalogue category.');
    const color_ids = s?.color_ids == null || (Array.isArray(s.color_ids) && !s.color_ids.length) ? null : idArray(s.color_ids, 200);
    if (s?.color_ids != null && Array.isArray(s.color_ids) && s.color_ids.length && !color_ids) return fail('Invalid colours.');
    sources.push({ site_category_id: id, category_id, grade_id: s?.grade_id == null ? null : positiveId(s.grade_id), color_ids, sort_order: (i + 1) * 10 });
  }
  if (new Set(sources.map((s) => s.category_id)).size !== sources.length) return fail('Each catalogue category can be linked once.');

  const { error: delErr } = await supabaseAdmin.from('site_category_sources').delete().eq('site_category_id', id);
  if (delErr) return fail(delErr.message);
  if (sources.length) {
    const { error } = await supabaseAdmin.from('site_category_sources').insert(sources);
    if (error) return fail(`Could not save links: ${error.message}`);
  }
  await supabaseAdmin.from('site_category_grades').delete().eq('site_category_id', id);
  const allGrades = [...new Set([...gradeIds, ...sources.map((s) => s.grade_id).filter((g): g is number => !!g)])];
  if (allGrades.length) {
    const { error } = await supabaseAdmin.from('site_category_grades').insert(allGrades.map((grade_id) => ({ site_category_id: id, grade_id })));
    if (error) return fail(error.message);
  }
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
