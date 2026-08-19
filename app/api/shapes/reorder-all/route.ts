import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Persists a full new order in one shot (drag-and-drop can jump more than one
// position, unlike the neighbor-swap /api/shapes/reorder) -- sort_order
// becomes each id's index in the array as given.
// Body: { orderedIds: number[] }
export async function POST(req: NextRequest) {
  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 });
  }

  const results = await Promise.all(
    orderedIds.map((id: number, index: number) => supabaseAdmin.from('shapes').update({ sort_order: index }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
