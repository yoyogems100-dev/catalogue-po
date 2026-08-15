import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const { category_id, photo_id } = await req.json();
  if (!category_id) return NextResponse.json({ error: 'category_id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from('categories').update({ thumbnail_photo_id: photo_id ?? null }).eq('id', category_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
