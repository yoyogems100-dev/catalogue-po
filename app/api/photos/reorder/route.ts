import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Swaps a photo's sort_order with its immediate neighbor in the given direction.
// Body: { category_id: number, photo_id: number, direction: 'left' | 'right' }
export async function POST(req: NextRequest) {
  const { category_id, photo_id, direction } = await req.json();
  if (!category_id || !photo_id || !direction) {
    return NextResponse.json({ error: 'category_id, photo_id, direction required' }, { status: 400 });
  }

  const { data: photos, error } = await supabaseAdmin
    .from('photos')
    .select('id, sort_order')
    .eq('category_id', category_id)
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ordered = photos || [];
  // Normalize sort_order to match current array position first, so swaps are well-defined
  // even if sort_order values were never set (all default 0).
  const normalized = ordered.map((p, i) => ({ id: p.id, sort_order: i }));

  const idx = normalized.findIndex((p) => p.id === photo_id);
  if (idx === -1) return NextResponse.json({ error: 'photo not in this category' }, { status: 400 });

  const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= normalized.length) return NextResponse.json({ ok: true }); // already at the edge, no-op

  const a = normalized[idx];
  const b = normalized[swapIdx];
  [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];

  await Promise.all(
    normalized.map((p) => supabaseAdmin.from('photos').update({ sort_order: p.sort_order }).eq('id', p.id))
  );

  return NextResponse.json({ ok: true });
}
