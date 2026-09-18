import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

const TABLES = { orders: 'orders', customers: 'customers', suppliers: 'suppliers' } as const;
type BinType = keyof typeof TABLES;

// Permanent, irreversible deletion -- only reachable from the Bin page, and
// only for a row already soft-deleted (deleted_at set). The database's own
// foreign key rules decide what happens to related rows: an order's items/
// notes/history cascade-delete with it; a deleted customer or supplier only
// clears the reference on their past order items (ON DELETE SET NULL), never
// deletes the order itself.
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { type, id } = await req.json();
  if (!(type in TABLES) || !Number.isSafeInteger(id)) return NextResponse.json({ error: 'type and id required' }, { status: 400 });

  const table = TABLES[type as BinType];
  const { error } = await supabaseAdmin.from(table).delete().eq('id', id).not('deleted_at', 'is', null);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
