import { NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { getLastOrder } from '@/lib/last-order-server';

// Read-only: what this buyer ordered last (lib/usual-picks), so the admin
// order builder can list those options first once the buyer is chosen.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: 'Invalid customer.' }, { status: 400 });
  return NextResponse.json({ lastOrder: await getLastOrder(id) });
}
