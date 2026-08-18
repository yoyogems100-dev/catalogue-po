import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Swaps a shape's sort_order with its immediate neighbor in the master list --
// same pattern as /api/photos/reorder.
// Body: { shape_id: number, direction: 'up' | 'down' }
export async function POST(req: NextRequest) {
  const { shape_id, direction } = await req.json();
  if (!shape_id || !direction) {
    return NextResponse.json({ error: 'shape_id and direction required' }, { status: 400 });
  }

  const { data: shapes, error } = await supabaseAdmin
    .from('shapes')
    .select('id, sort_order')
    .order('sort_order', { ascending: true })
    .order('id', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ordered = shapes || [];
  const normalized = ordered.map((s, i) => ({ id: s.id, sort_order: i }));

  const idx = normalized.findIndex((s) => s.id === shape_id);
  if (idx === -1) return NextResponse.json({ error: 'shape not found' }, { status: 400 });

  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= normalized.length) return NextResponse.json({ ok: true });

  const a = normalized[idx];
  const b = normalized[swapIdx];
  [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];

  await Promise.all(
    normalized.map((s) => supabaseAdmin.from('shapes').update({ sort_order: s.sort_order }).eq('id', s.id))
  );

  return NextResponse.json({ ok: true });
}
