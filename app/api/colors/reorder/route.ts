import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Swaps a color's sort_order with its immediate neighbor in the master list --
// same pattern as /api/photos/reorder.
// Body: { color_id: number, direction: 'up' | 'down' }
export async function POST(req: NextRequest) {
  const { color_id, direction } = await req.json();
  if (!color_id || !direction) {
    return NextResponse.json({ error: 'color_id and direction required' }, { status: 400 });
  }

  const { data: colors, error } = await supabaseAdmin
    .from('colors')
    .select('id, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ordered = colors || [];
  const normalized = ordered.map((c, i) => ({ id: c.id, sort_order: i }));

  const idx = normalized.findIndex((c) => c.id === color_id);
  if (idx === -1) return NextResponse.json({ error: 'color not found' }, { status: 400 });

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= normalized.length) return NextResponse.json({ ok: true });

  const a = normalized[idx];
  const b = normalized[swapIdx];
  [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];

  await Promise.all(
    normalized.map((c) => supabaseAdmin.from('colors').update({ sort_order: c.sort_order }).eq('id', c.id))
  );

  return NextResponse.json({ ok: true });
}
