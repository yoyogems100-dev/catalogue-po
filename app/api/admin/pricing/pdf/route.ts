import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { isAdminAuthed } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getSettings } from '@/lib/settings';
import PriceListPdfDocument, { type PriceListData, type PriceListShapeSection } from '@/lib/pdf/PriceListPdfDocument';
import { getPdfLogoDataUrl } from '@/lib/pdf/brand';
import { priceColumns, groupsInScope, showShapeHeadings } from '@/lib/price-columns';
import GSeriesPriceListDocument from '@/lib/pdf/GSeriesPriceListDocument';
import { gridToEntries, loadGSeriesGrid, loadGSeriesPriceList, saveCustomerPrices } from '@/lib/g-series-pdf';
import { parsePriceListOptions, priceListFileName, type PriceListOptions } from '@/lib/price-list-options';
import { categoryDefaultEntries, customerListEntries } from '@/lib/customer-prices';

async function gSeriesPdf(categoryId: number, options?: Partial<PriceListOptions> & { listId?: number | null }, extraHeaders: Record<string, string> = {}) {
  const data = await loadGSeriesPriceList(categoryId, options);
  if (!data) return null;
  const buffer = await renderToBuffer(React.createElement(GSeriesPriceListDocument, { data }) as any);
  const fileName = priceListFileName('YOYO-GEMS-Crushed-Ice-G-Series-Price-List', { customerName: data.customerName, date: data.date });
  return new NextResponse(new Uint8Array(buffer), {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${fileName}"`, 'Cache-Control': 'private, no-store', ...extraHeaders }
  });
}

/**
 * The download dialog's copy: a customer's name, a date and the prices on
 * screen (rows of the grid `source_list_id`, or of the defaults). With
 * `save_for_customer` and a name, those prices also become that customer's
 * saved list; otherwise nothing is written.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json().catch(() => null);
  const categoryId = Number(body?.category_id);
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  const sourceListId = Number(body?.source_list_id) > 0 ? Number(body.source_list_id) : null;
  const loaded = await loadGSeriesGrid(categoryId, sourceListId);
  const parsed = parsePriceListOptions(body, loaded ? { rows: loaded.grid.rows.length, columns: loaded.grid.columns.length } : null);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { options } = parsed;

  const headers: Record<string, string> = {};
  if (body?.save_for_customer && options.customerName && loaded) {
    try {
      const sameCustomer = loaded.list && loaded.list.customerName.trim().toLowerCase() === options.customerName.toLowerCase();
      const listId = await saveCustomerPrices(categoryId, {
        listId: sameCustomer ? loaded.list!.id : null,
        customerName: options.customerName,
        priceDate: options.date,
        entries: gridToEntries(loaded.grid, options.prices || loaded.grid.rows.map((r) => r.prices))
      });
      headers['X-Price-List-Id'] = String(listId);
    } catch {
      return NextResponse.json({ error: 'The customer’s prices could not be saved, so nothing was downloaded. Please retry.' }, { status: 500 });
    }
  }
  if (loaded) {
    const pdf = await gSeriesPdf(categoryId, { ...options, listId: sourceListId }, headers);
    return pdf || NextResponse.json({ error: 'This category has no customer price list.' }, { status: 404 });
  }

  // Every other category: the plain price list, for a customer and a date --
  // their saved prices (source_list_id) or the defaults, and optionally kept
  // as that customer's copy for next time.
  let listId = sourceListId;
  if (body?.save_for_customer && options.customerName) {
    try {
      const source = sourceListId ? await customerListEntries(categoryId, sourceListId) : null;
      const sameCustomer = source && source.list.customerName.trim().toLowerCase() === options.customerName.toLowerCase();
      listId = await saveCustomerPrices(categoryId, {
        listId: sameCustomer ? source!.list.id : null,
        customerName: options.customerName,
        priceDate: options.date,
        entries: source ? source.entries : await categoryDefaultEntries(categoryId)
      });
      headers['X-Price-List-Id'] = String(listId);
    } catch {
      return NextResponse.json({ error: 'The customer’s prices could not be saved, so nothing was downloaded. Please retry.' }, { status: 500 });
    }
  }
  return standardPdf(categoryId, { customerName: options.customerName, date: options.date, listId }, headers);
}

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const categoryId = Number(req.nextUrl.searchParams.get('category_id'));
  if (!categoryId) return NextResponse.json({ error: 'category_id required' }, { status: 400 });
  if (categoryId === 34) return NextResponse.redirect(new URL('/api/categories/34/size-chart?type=prices', req.url));

  // Crushed Ice prices by G-Series column: one illustrated page laid out
  // like the supplier's sheet, instead of a table per shape.
  const gSeries = await gSeriesPdf(categoryId);
  if (gSeries) return gSeries;
  return standardPdf(categoryId);
}

/**
 * The plain price list: a table per shape, one column per colour group.
 * Prints the default prices, or a customer's saved copy (listId), with
 * their name and the date when given.
 */
async function standardPdf(categoryId: number, opts: { customerName?: string | null; date?: string; listId?: number | null } = {}, extraHeaders: Record<string, string> = {}) {

  const [{ data: category }, { data: shapeLinks }, { data: groups }, { data: prices }, { data: categoryColors }, { data: groupMembers }, settings] = await Promise.all([
    supabaseAdmin.from('categories').select('id, name, price_unit').eq('id', categoryId).single(),
    supabaseAdmin.from('category_shapes').select('shape_id, shapes(id, name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, name, is_catch_all, category_id').order('sort_order'),
    supabaseAdmin.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_inr').eq('category_id', categoryId),
    supabaseAdmin.from('category_colors').select('color_id, colors(name)').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id'),
    getSettings()
  ]);

  if (!category) return NextResponse.json({ error: 'Category not found' }, { status: 404 });

  const shapeIds = (shapeLinks || []).map((s: any) => s.shape_id);
  const { data: sizeLinks } = shapeIds.length
    ? await supabaseAdmin.from('category_shape_sizes').select('shape_size_id, shape_sizes(id, shape_id, size_mm)').eq('category_id', categoryId)
    : { data: [] };

  const sizesByShape: Record<number, { id: number; sizeMm: string }[]> = {};
  (sizeLinks || []).forEach((s: any) => {
    const shapeId = s.shape_sizes.shape_id;
    if (!sizesByShape[shapeId]) sizesByShape[shapeId] = [];
    sizesByShape[shapeId].push({ id: s.shape_sizes.id, sizeMm: s.shape_sizes.size_mm });
  });
  Object.values(sizesByShape).forEach((list) =>
    list.sort((a, b) => a.sizeMm.localeCompare(b.sizeMm, undefined, { numeric: true }))
  );

  const priceLookup = new Map<string, number>();
  const customer = opts.listId ? await customerListEntries(categoryId, opts.listId) : null;
  if (opts.listId && !customer) return NextResponse.json({ error: 'That customer’s prices were not found.' }, { status: 404 });
  if (customer) customer.entries.forEach((e) => priceLookup.set(`${e.shapeSizeId}:${e.groupId}`, e.price));
  else (prices || []).forEach((p: any) => { if (p.price_inr !== null) priceLookup.set(`${p.shape_size_id}:${p.price_group_id}`, Number(p.price_inr)); });

  const colorsFormatted = (categoryColors || [])
    .map((row: any) => ({ id: row.color_id, name: (Array.isArray(row.colors) ? row.colors[0] : row.colors)?.name }))
    .filter((c: any): c is { id: number; name: string } => Boolean(c.name));
  // Same columns and the same naming rule the admin table uses, so the PDF a
  // customer receives matches the screen the price was typed into.
  const columns = priceColumns(groupsInScope(groups || [], categoryId), colorsFormatted, groupMembers || []);
  const groupsFormatted = columns.map((c) => ({ id: c.groupId, name: c.label, colors: c.colors }));

  // Only shapes that actually have a priced size are worth a page section --
  // a linked-but-unpriced shape would just render an empty table.
  const sections: PriceListShapeSection[] = (shapeLinks || [])
    .map((s: any) => {
      const sizes = sizesByShape[s.shape_id] || [];
      const rows = sizes.map((size) => {
        const rowPrices: Record<number, number | null> = {};
        groupsFormatted.forEach((g: { id: number }) => {
          const price = priceLookup.get(`${size.id}:${g.id}`);
          rowPrices[g.id] = price ?? null;
        });
        return { sizeMm: size.sizeMm, prices: rowPrices };
      });
      return { shapeName: s.shapes.name, rows };
    })
    .filter((section: PriceListShapeSection) => section.rows.some((r) => Object.values(r.prices).some((v) => v !== null)));

  const data: PriceListData = {
    categoryName: category.name,
    generatedAt: new Date().toISOString(),
    groups: groupsFormatted,
    // With one shape there is nothing to tell apart, so the table needs no
    // heading over it -- most of these categories are round only.
    showShapeHeadings: showShapeHeadings(sections.length),
    sections,
    priceUnit: (category as any).price_unit ?? null,
    logoUrl: await getPdfLogoDataUrl(),
    contactWhatsapp: settings.whatsapp_number || null,
    contactLocation: settings.location || null,
    customerName: opts.customerName || null,
    date: opts.date || null
  };

  const buffer = await renderToBuffer(React.createElement(PriceListPdfDocument, { data }) as any);

  const base = `price-list-${category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const fileName = opts.customerName || opts.date ? priceListFileName(base, { customerName: opts.customerName || null, date: opts.date || '' }) : `${base}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
      ...extraHeaders
    }
  });
}
