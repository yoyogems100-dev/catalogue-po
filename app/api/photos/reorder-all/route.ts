import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Same batch-reorder pattern as /api/shapes/reorder-all, scoped to one
// category's photos.
// Body: { category_id: number, orderedIds: number[] }
export async function POST(req: NextRequest) {
  const { category_id, orderedIds } = await req.json();
  if (!category_id || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return NextResponse.json({ error: 'category_id and orderedIds required' }, { status: 400 });
  }

  const results = await Promise.all(
    orderedIds.map((id: number, index: number) =>
      supabaseAdmin.from('photos').update({ sort_order: index }).eq('id', id).eq('category_id', category_id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
