import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json(); const name = String(body.name || '').trim();
  if (!name) return NextResponse.json({ error: 'Supplier name is required.' }, { status: 400 });
  const { data, error } = await supabaseAdmin.from('suppliers').insert({ name, phone: String(body.phone || '').trim() || null }).select('id').single();
  if (error || !data) return NextResponse.json({ error: error?.message || 'Could not create supplier.' }, { status: 400 });
  return NextResponse.json({ id: data.id });
}
