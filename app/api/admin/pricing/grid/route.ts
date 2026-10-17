import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import {
  columnPhotos, deleteCustomerPrices, gridToEntries, listCustomerPriceLists, loadGSeriesGrid, saveCustomerPrices, saveDefaultPrices
} from '@/lib/g-series-pdf';
import { buyerNames } from '@/lib/customer-prices';
import { CUSTOMER_NAME_MAX, parsePriceMatrix, tidyCustomerName, todayIso, validDate } from '@/lib/price-list-options';

const noStore = { 'Cache-Control': 'private, no-store' };
const listIdOf = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/**
 * The price grid the Pricing page and the download dialog edit: the default
 * prices, or one customer's saved list (`list_id`). `grid: null` means the
 * category has no customer price list, and the plain screens are used.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const listId = listIdOf(req.nextUrl.searchParams.get('list_id'));
  const loaded = await loadGSeriesGrid(categoryId, listId);
  if (!loaded) {
    if (listId) return NextResponse.json({ error: 'That customer price list was not found.' }, { status: 404 });
    return NextResponse.json({ grid: null }, { headers: noStore });
  }
  const [lists, photos, buyers] = await Promise.all([listCustomerPriceLists(categoryId), columnPhotos(categoryId, loaded.grid), buyerNames()]);
  return NextResponse.json({ grid: loaded.grid, list: loaded.list, lists, photos, buyers }, { headers: noStore });
}

/**
 * Save edited prices. The grid typed into is `source_list_id` (null = the
 * defaults). They are saved as the defaults, or as a customer's list -- that
 * customer's existing one when the name matches, else a new one.
 */
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.category_id);
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const sourceListId = listIdOf(body?.source_list_id);
  const loaded = await loadGSeriesGrid(categoryId, sourceListId);
  if (!loaded) return NextResponse.json({ error: 'This price list was not found. Reload the page.' }, { status: 404 });
  const parsed = parsePriceMatrix(body?.prices, { rows: loaded.grid.rows.length, columns: loaded.grid.columns.length });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    if (body?.target === 'default') {
      if (sourceListId) return NextResponse.json({ error: 'Open the default prices to change them.' }, { status: 400 });
      const changed = await saveDefaultPrices(categoryId, loaded.grid, parsed.prices);
      return NextResponse.json({ ok: true, changed, listId: null });
    }
    // One customer, or several who get the same prices (the first is the
    // copy being edited, if any).
    const raw = Array.isArray(body?.customer_names) && body.customer_names.length ? body.customer_names : [body?.customer_name];
    const names = [...new Map(raw.map((n: unknown) => tidyCustomerName(n)).filter(Boolean).map((n: string) => [n.toLowerCase(), n] as const)).values()] as string[];
    if (!names.length) return NextResponse.json({ error: 'Enter the customer’s name.' }, { status: 400 });
    if (names.length > 50) return NextResponse.json({ error: 'Choose up to 50 customers at a time.' }, { status: 400 });
    if (names.some((n) => n.length > CUSTOMER_NAME_MAX)) return NextResponse.json({ error: `Keep the customer name under ${CUSTOMER_NAME_MAX} characters.` }, { status: 400 });
    const date = body?.date ? body.date : todayIso();
    if (!validDate(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
    const entries = gridToEntries(loaded.grid, parsed.prices);
    const ids: number[] = [];
    for (const [i, name] of names.entries()) {
      ids.push(await saveCustomerPrices(categoryId, { listId: i === 0 ? listIdOf(body?.target_list_id) : null, customerName: name, priceDate: date, entries }));
    }
    return NextResponse.json({ ok: true, listId: ids[0], listIds: ids });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Another customer already has that name. Choose them from the list instead.' }, { status: 409 });
    return NextResponse.json({ error: 'The prices could not be saved. Please retry.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  const listId = listIdOf(req.nextUrl.searchParams.get('list_id'));
  if (!categoryId || !listId) return NextResponse.json({ error: 'category_id and list_id required' }, { status: 400 });
  try {
    await deleteCustomerPrices(categoryId, listId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'The customer’s prices could not be removed. Please retry.' }, { status: 500 });
  }
}
