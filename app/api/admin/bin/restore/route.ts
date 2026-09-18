import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TABLES = { orders: 'orders', customers: 'customers', suppliers: 'suppliers' } as const;
type BinType = keyof typeof TABLES;

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, id } = await req.json();
  if (!(type in TABLES) || !Number.isSafeInteger(id)) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

  const { error } = await supabaseAdmin.from(TABLES[type as BinType]).update({ deleted_at: null }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
