import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthed } from '@/lib/auth';
import { listCustomerPriceLists, saveCustomerPrices } from '@/lib/g-series-pdf';
import { buyerNames, customerListEntries, validEntries } from '@/lib/customer-prices';
import { CUSTOMER_NAME_MAX, tidyCustomerName, todayIso, validDate } from '@/lib/price-list-options';
import { catalogueChanged } from '@/lib/catalogue-cache';

const noStore = { 'Cache-Control': 'private, no-store' };
const idOf = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

/**
 * Customer prices for a category on the plain price table (every category
 * except Crushed Ice, which has its own grid at /api/admin/pricing/grid):
 * the saved customers, buyer account names to pick from, and with `list_id`
 * one customer's prices.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const categoryId = idOf(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const listId = idOf(req.nextUrl.searchParams.get('list_id'));
  const [lists, buyers, one] = await Promise.all([
    listCustomerPriceLists(categoryId),
    buyerNames(),
    listId ? customerListEntries(categoryId, listId) : null,
  ]);
  if (listId && !one) return NextResponse.json({ error: 'That customer’s prices were not found.' }, { status: 404 });
  return NextResponse.json({
    lists, buyers,
    ...(one ? { list: one.list, entries: one.entries.map((e) => ({ s: e.shapeSizeId, g: e.groupId, p: e.price })) } : {}),
  }, { headers: noStore });
}

/**
 * Save customer prices: the prices on screen as each named customer's copy.
 * `list_id` is the copy being edited (it may be renamed); every other name
 * updates that customer's copy if they have one, else starts one. The
 * default prices are not touched.
 */
export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  catalogueChanged();
  const body = await req.json().catch(() => null);
  const categoryId = idOf(body?.category_id);
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const names = [...new Map((Array.isArray(body?.customer_names) ? body.customer_names : []).map((n: unknown) => tidyCustomerName(n)).filter(Boolean)
    .map((n: string) => [n.toLowerCase(), n] as const)).values()] as string[];
  if (!names.length) return NextResponse.json({ error: 'Choose or type at least one customer.' }, { status: 400 });
  if (names.length > 50) return NextResponse.json({ error: 'Choose up to 50 customers at a time.' }, { status: 400 });
  if (names.some((n) => n.length > CUSTOMER_NAME_MAX)) return NextResponse.json({ error: `Keep each customer name under ${CUSTOMER_NAME_MAX} characters.` }, { status: 400 });
  const date = body?.date ? body.date : todayIso();
  if (!validDate(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const entries = await validEntries(categoryId, body?.entries);
  if (!entries) return NextResponse.json({ error: 'The prices changed since this screen opened. Reload and try again.' }, { status: 400 });

  const listId = idOf(body?.list_id);
  try {
    const ids: number[] = [];
    for (const [i, name] of names.entries()) {
      ids.push(await saveCustomerPrices(categoryId, { listId: i === 0 ? listId : null, customerName: name, priceDate: date, entries }));
    }
    return NextResponse.json({ ok: true, listIds: ids });
  } catch (error: any) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Another customer already has that name. Choose them from the list instead.' }, { status: 409 });
    return NextResponse.json({ error: 'The prices could not be saved. Please retry.' }, { status: 500 });
  }
}
