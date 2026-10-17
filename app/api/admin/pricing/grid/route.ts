import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { loadGSeriesGrid } from '@/lib/g-series-pdf';

// The saved price grid for the "Download price list" dialog to pre-fill.
// `grid: null` means the category has no customer price list, and the
// button downloads the plain list straight away.
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const grid = await loadGSeriesGrid(categoryId);
  return NextResponse.json({ grid }, { headers: { 'Cache-Control': 'private, no-store' } });
}
