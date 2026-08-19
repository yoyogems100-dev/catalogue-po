import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// New categories go to the end of the list -- drag-and-drop is how you move
// them elsewhere afterward, same as a freshly added shape/color.
export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const baseSlug = slugify(name.trim());
  if (!baseSlug) return NextResponse.json({ error: 'Name must contain at least one letter or number' }, { status: 400 });

  const { data: existing } = await supabaseAdmin.from('categories').select('slug').like('slug', `${baseSlug}%`);
  const existingSlugs = new Set((existing || []).map((r: any) => r.slug));
  let slug = baseSlug;
  let n = 2;
  while (existingSlugs.has(slug)) {
    slug = `${baseSlug}-${n}`;
    n++;
  }

  const { data: maxRow } = await supabaseAdmin.from('categories').select('num').order('num', { ascending: false }).limit(1).maybeSingle();
  const nextNum = (maxRow?.num || 0) + 1;

  const { data, error } = await supabaseAdmin
    .from('categories')
    .insert({ name: name.trim(), slug, num: nextNum })
    .select('id, num, name, slug')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
