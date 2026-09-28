import { isAdminAuthed } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { refreshPublicSite } from '@/lib/site/api';

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
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

const BADGE_TYPES = ['shapes', 'colors', 'sizes'];

export async function PATCH(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, name, badge_types, archived } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updates: Record<string, any> = {};
  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
    updates.name = name.trim();
  }
  if (badge_types !== undefined) {
    if (!Array.isArray(badge_types) || !badge_types.every((b) => BADGE_TYPES.includes(b))) {
      return NextResponse.json({ error: 'Invalid badge_types' }, { status: 400 });
    }
    updates.badge_types = badge_types;
  }
  if (archived !== undefined) {
    if (typeof archived !== 'boolean') return NextResponse.json({ error: 'Invalid archived' }, { status: 400 });
    updates.archived_at = archived ? new Date().toISOString() : null;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('categories').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (archived !== undefined) {
    const renumbered = await renumberActiveFirst();
    if (renumbered) return NextResponse.json({ error: renumbered }, { status: 400 });
    refreshPublicSite();
  }
  return NextResponse.json(data);
}

// num is both the sort order and the "01, 02 ..." shown to customers, so an
// archived category moves behind every live one and the live ones close up
// with no gaps. A restored category keeps its (now highest) number and so
// lands at the end of the live list, where it can be dragged into place.
async function renumberActiveFirst(): Promise<string | null> {
  const { data: rows, error } = await supabaseAdmin.from('categories').select('id, num, archived_at').order('num').order('id');
  if (error) return error.message;
  const ordered = [...(rows || []).filter((r) => !r.archived_at), ...(rows || []).filter((r) => r.archived_at)];
  const results = await Promise.all(ordered
    .map((r, index) => ({ r, num: index + 1 }))
    .filter(({ r, num }) => r.num !== num)
    .map(({ r, num }) => supabaseAdmin.from('categories').update({ num }).eq('id', r.id)));
  return results.find((r) => r.error)?.error?.message || null;
}

// Cascades to the category's photos and shape/color/size/tag links (FK
// on delete cascade); order_items.category_id is set null so past orders
// keep their line items instead of being deleted.
export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('categories').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
