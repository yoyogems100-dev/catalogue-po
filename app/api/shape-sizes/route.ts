import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Accepts either a single size (size_mm [+ weight_ct]) or a bulk list
// (sizes: [{ size_mm, weight_ct? }, ...]) so the admin can add many sizes to
// a shape in one action instead of one form-submit per size.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { shape_id } = body;
  if (!shape_id) return NextResponse.json({ error: 'shape_id required' }, { status: 400 });

  const rawSizes: { size_mm: string; weight_ct?: number | null }[] = Array.isArray(body.sizes)
    ? body.sizes
    : body.size_mm?.trim()
    ? [{ size_mm: body.size_mm, weight_ct: body.weight_ct }]
    : [];

  const rows = rawSizes
    .map((s) => ({ shape_id, size_mm: (s.size_mm || '').trim(), weight_ct: s.weight_ct || null }))
    .filter((r) => r.size_mm.length > 0);

  if (rows.length === 0) return NextResponse.json({ error: 'At least one size_mm required' }, { status: 400 });

  const { data, error } = await supabaseAdmin.from('shape_sizes').insert(rows).select();
  if (error) {
    // Bulk insert is all-or-nothing on a unique-constraint hit -- surface which
    // value collided so the admin can drop just that one and retry the rest,
    // rather than a raw Postgres error with no obvious next step.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'One or more of these sizes already exist for this shape. Remove the duplicate(s) and try again.' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ sizes: data });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const { error } = await supabaseAdmin.from('shape_sizes').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
