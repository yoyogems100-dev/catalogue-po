import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, idArray, readJson, refreshPublicSite, requireAdmin } from '@/lib/site/api';
import { cleanAnswer, cleanQuestion } from '@/lib/site/faq';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const question = cleanQuestion(body?.question);
  if (!question) return fail('Write the question first.');
  const { data: last } = await supabaseAdmin.from('site_faqs').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { data, error } = await supabaseAdmin.from('site_faqs')
    .insert({ question, answer: cleanAnswer(body?.answer), sort_order: (last?.[0]?.sort_order ?? 0) + 10 }).select('id').single();
  if (error) return fail(error.message);
  refreshPublicSite();
  return NextResponse.json({ id: data.id });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const ids = idArray((await readJson(req))?.ids, 200);
  if (!ids?.length) return fail('Nothing to reorder.');
  for (const [i, id] of ids.entries()) await supabaseAdmin.from('site_faqs').update({ sort_order: (i + 1) * 10 }).eq('id', id);
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
