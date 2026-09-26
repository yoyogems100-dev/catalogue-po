import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { fail, idArray, readJson, refreshPublicSite, requireAdmin, slugify } from '@/lib/site/api';

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const body = await readJson(req);
  const name = typeof body?.name === 'string' ? body.name.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
  const code = slugify(name);
  if (!name || !code) return fail('Give the grade a name.');
  const { data: last } = await supabaseAdmin.from('site_grades').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { data, error } = await supabaseAdmin.from('site_grades')
    .insert({ name, code, sort_order: (last?.[0]?.sort_order ?? 0) + 10 }).select('id').single();
  if (error) return fail(error.code === '23505' ? `A grade called "${name}" already exists.` : error.message);
  refreshPublicSite();
  return NextResponse.json({ id: data.id });
}

export async function PUT(req: NextRequest) {
  const denied = await requireAdmin(); if (denied) return denied;
  const ids = idArray((await readJson(req))?.ids, 100);
  if (!ids?.length) return fail('Nothing to reorder.');
  for (const [i, id] of ids.entries()) await supabaseAdmin.from('site_grades').update({ sort_order: (i + 1) * 10 }).eq('id', id);
  refreshPublicSite();
  return NextResponse.json({ ok: true });
}
