import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Same batch-reorder pattern as /api/shapes/reorder-all -- num is both the
// sort key and the "#" shown in the admin table, so dragging renumbers it
// 1-indexed to match the existing display convention.
// Body: { orderedIds: number[] }
export async function POST(req: NextRequest) {
  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'orderedIds required' }, { status: 400 });
  }

  const results = await Promise.all(
    orderedIds.map((id: number, index: number) => supabaseAdmin.from('categories').update({ num: index + 1 }).eq('id', id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
