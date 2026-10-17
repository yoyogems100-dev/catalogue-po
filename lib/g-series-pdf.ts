import { supabaseAdmin } from './supabase-admin';
import { getSettings } from './settings';
import { getPdfLogoDataUrl } from './pdf/brand';
import { publicThumbDataUrl } from './pdf/image-data-url';
import { priceUnitLabel } from './price-unit';
import { buildGSeriesGrid, G_SERIES_PREFIX, parseGSeriesGroup, type GSeriesGrid } from './g-series-grid';
import type { GSeriesPriceListData, GSeriesSwatch } from './pdf/GSeriesPriceListDocument';
import { todayIso, type PriceListOptions } from './price-list-options';
import type { PriceEntry } from './g-series-entries';
export { gridToEntries } from './g-series-entries';

/**
 * Crushed Ice G-Series prices: the category's default prices (stored in
 * shape_size_prices, one per size and column) and each customer's own copy
 * (customer_price_lists, a snapshot of the defaults edited for that buyer).
 * Both are shown and printed as the same grid -- see lib/g-series-grid.ts.
 */

export type CustomerPriceListSummary = { id: number; customerName: string; priceDate: string; updatedAt: string };
type Group = { id: number; name: string };

const byCode = (a: GSeriesSwatch, b: GSeriesSwatch) => a.code.localeCompare(b.code, undefined, { numeric: true });

/** "G-40 White D" -> { code: "G-40", name: "White D" }. */
function splitColorName(name: string) {
  const [code, ...rest] = name.split(' ');
  return { code, name: rest.join(' ') };
}

async function gSeriesGroups(categoryId: number): Promise<Group[]> {
  const { data: groups } = await supabaseAdmin
    .from('color_price_groups').select('id, name').eq('category_id', categoryId).like('name', `${G_SERIES_PREFIX}%`);
  return (groups || []).filter((g: any) => parseGSeriesGroup(g.name)) as Group[];
}

async function shapesAndSizes(categoryId: number) {
  const [{ data: shapeLinks }, { data: sizeLinks }] = await Promise.all([
    supabaseAdmin.from('category_shapes').select('shape_id, shapes(id, name, icon_key)').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_sizes(id, shape_id, size_mm)').eq('category_id', categoryId)
  ]);
  const shapes = (shapeLinks || []).map((l: any) => {
    const shape = Array.isArray(l.shapes) ? l.shapes[0] : l.shapes;
    return { id: l.shape_id as number, name: (shape?.name || `Shape ${l.shape_id}`) as string, iconKey: (shape?.icon_key ?? null) as string | null };
  });
  const sizes = (sizeLinks || []).map((l: any) => l.shape_sizes).filter(Boolean)
    .map((s: any) => ({ id: s.id as number, shapeId: s.shape_id as number, sizeMm: s.size_mm as string }));
  return { shapes, sizes };
}

async function defaultEntries(categoryId: number, groups: Group[]): Promise<PriceEntry[]> {
  const { data } = await supabaseAdmin.from('shape_size_prices').select('shape_size_id, price_group_id, price_inr')
    .eq('category_id', categoryId).in('price_group_id', groups.map((g) => g.id));
  return (data || []).filter((p: any) => p.price_inr !== null)
    .map((p: any) => ({ shapeSizeId: p.shape_size_id, groupId: p.price_group_id, price: Number(p.price_inr) }));
}

function entriesFromJson(json: unknown): PriceEntry[] {
  if (!Array.isArray(json)) return [];
  return json.filter((e: any) => Number.isFinite(e?.s) && Number.isFinite(e?.g) && Number.isFinite(e?.p))
    .map((e: any) => ({ shapeSizeId: e.s, groupId: e.g, price: e.p }));
}
const entriesToJson = (entries: PriceEntry[]) => entries.map((e) => ({ s: e.shapeSizeId, g: e.groupId, p: e.price }));

/** The saved customer lists for a category, most recently updated first. */
export async function listCustomerPriceLists(categoryId: number): Promise<CustomerPriceListSummary[]> {
  const { data } = await supabaseAdmin.from('customer_price_lists').select('id, customer_name, price_date, updated_at')
    .eq('category_id', categoryId).order('updated_at', { ascending: false });
  return (data || []).map((r: any) => ({ id: r.id, customerName: r.customer_name, priceDate: r.price_date, updatedAt: r.updated_at }));
}

async function customerList(categoryId: number, listId: number) {
  const { data } = await supabaseAdmin.from('customer_price_lists').select('id, customer_name, price_date, prices')
    .eq('category_id', categoryId).eq('id', listId).maybeSingle();
  return data as { id: number; customer_name: string; price_date: string; prices: unknown } | null;
}

export type LoadedGrid = { grid: GSeriesGrid; list: { id: number; customerName: string; priceDate: string } | null };

/**
 * The grid of default prices, or of one customer's list. Null when the
 * category has no G-Series columns, or the customer list isn't there.
 */
export async function loadGSeriesGrid(categoryId: number, listId?: number | null): Promise<LoadedGrid | null> {
  const groups = await gSeriesGroups(categoryId);
  if (!groups.length) return null;
  const [{ shapes, sizes }, list] = await Promise.all([shapesAndSizes(categoryId), listId ? customerList(categoryId, listId) : null]);
  if (listId && !list) return null;
  const entries = list ? entriesFromJson(list.prices) : await defaultEntries(categoryId, groups);
  return {
    grid: buildGSeriesGrid(groups, shapes, sizes, entries),
    list: list ? { id: list.id, customerName: list.customer_name, priceDate: list.price_date } : null
  };
}

/** Write the changed cells of the default grid into shape_size_prices. Returns how many rows changed. */
export async function saveDefaultPrices(categoryId: number, grid: GSeriesGrid, prices: (number | null)[][]) {
  const { data: sizeRows, error: sizeError } = await supabaseAdmin.from('shape_sizes').select('id, shape_id')
    .in('id', grid.rows.flatMap((r) => r.shapeSizeIds));
  if (sizeError) throw sizeError;
  const shapeOf = new Map((sizeRows || []).map((r: any) => [r.id, r.shape_id]));
  const upserts: any[] = [];
  const clears: { shapeSizeId: number; groupId: number }[] = [];
  grid.rows.forEach((row, ri) => grid.columns.forEach((col, ci) => {
    const price = prices[ri][ci];
    if (price === row.prices[ci]) return; // unchanged
    for (const shapeSizeId of row.shapeSizeIds) {
      if (price === null) clears.push({ shapeSizeId, groupId: col.id });
      else upserts.push({ category_id: categoryId, shape_id: shapeOf.get(shapeSizeId), shape_size_id: shapeSizeId, price_group_id: col.id, price_inr: price });
    }
  }));
  if (upserts.length) {
    const { error } = await supabaseAdmin.from('shape_size_prices')
      .upsert(upserts, { onConflict: 'category_id,shape_id,shape_size_id,price_group_id' });
    if (error) throw error;
  }
  for (const c of clears) {
    const { error } = await supabaseAdmin.from('shape_size_prices').delete()
      .eq('category_id', categoryId).eq('shape_size_id', c.shapeSizeId).eq('price_group_id', c.groupId);
    if (error) throw error;
  }
  return upserts.length + clears.length;
}

/**
 * Save a customer's prices: update their list (by id, or by name when one
 * with that name exists) or start a new one. Returns the list's id.
 */
export async function saveCustomerPrices(categoryId: number, input: { listId?: number | null; customerName: string; priceDate: string; entries: PriceEntry[] }) {
  const name = input.customerName.replace(/\s+/g, ' ').trim();
  let id = input.listId || null;
  if (!id) {
    const { data: lists } = await supabaseAdmin.from('customer_price_lists').select('id, customer_name').eq('category_id', categoryId);
    id = (lists || []).find((l: any) => l.customer_name.trim().toLowerCase() === name.toLowerCase())?.id ?? null;
  }
  const row = { category_id: categoryId, customer_name: name, price_date: input.priceDate, prices: entriesToJson(input.entries), updated_at: new Date().toISOString() };
  if (id) {
    const { error } = await supabaseAdmin.from('customer_price_lists').update(row).eq('id', id).eq('category_id', categoryId);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabaseAdmin.from('customer_price_lists').insert(row).select('id').single();
  if (error) throw error;
  return data.id as number;
}

export async function deleteCustomerPrices(categoryId: number, listId: number) {
  const { error } = await supabaseAdmin.from('customer_price_lists').delete().eq('id', listId).eq('category_id', categoryId);
  if (error) throw error;
}

export type ColumnColour = { code: string; name: string; url: string | null };

/** Each column's colours with their photos, for the Pricing page's headers and colour key. */
export async function columnPhotos(categoryId: number, grid: GSeriesGrid): Promise<Record<number, ColumnColour[]>> {
  const [{ data: members }, { data: colorLinks }] = await Promise.all([
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id').in('group_id', grid.columns.map((c) => c.id)),
    supabaseAdmin.from('category_colors').select('color_id, colors(name, ref_photo_url)').eq('category_id', categoryId)
  ]);
  const colors = new Map<number, any>((colorLinks || []).map((l: any) => [l.color_id, Array.isArray(l.colors) ? l.colors[0] : l.colors]));
  const out: Record<number, ColumnColour[]> = {};
  for (const col of grid.columns) {
    out[col.id] = (members || []).filter((m: any) => colors.get(m.color_id)?.name && m.group_id === col.id)
      .map((m: any) => ({ ...splitColorName(colors.get(m.color_id).name), url: (colors.get(m.color_id).ref_photo_url || null) as string | null }))
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  return out;
}

/**
 * Data for the illustrated G-Series price list, or null when the category
 * has no G-Series price columns (every other category keeps the plain list).
 * Prints the default prices, a customer's saved list (listId), or prices
 * typed in the download dialog (options.prices, rows of that grid).
 */
export async function loadGSeriesPriceList(categoryId: number, options?: Partial<PriceListOptions> & { listId?: number | null }): Promise<GSeriesPriceListData | null> {
  const loaded = await loadGSeriesGrid(categoryId, options?.listId);
  if (!loaded) return null;
  const { grid } = loaded;

  const [{ data: category }, { data: members }, { data: colorLinks }, settings, logoUrl] = await Promise.all([
    supabaseAdmin.from('categories').select('name, price_unit').eq('id', categoryId).single(),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id').in('group_id', grid.columns.map((c) => c.id)),
    supabaseAdmin.from('category_colors').select('color_id, colors(name, hex_value, ref_photo_url)').eq('category_id', categoryId),
    getSettings(),
    getPdfLogoDataUrl()
  ]);
  if (!category) return null;
  if (options?.prices) grid.rows.forEach((row, i) => { row.prices = options.prices![i]; });

  const swatches = new Map<number, GSeriesSwatch>();
  await Promise.all((colorLinks || []).map(async (l: any) => {
    const c = Array.isArray(l.colors) ? l.colors[0] : l.colors;
    if (!c?.name) return;
    swatches.set(l.color_id, { ...splitColorName(c.name), hex: c.hex_value || null, image: await publicThumbDataUrl(c.ref_photo_url) });
  }));

  // Only colours with a price column are listed; one the sheet doesn't price
  // is left off rather than shown without a price.
  const keyGroups = grid.columns.map((col) => {
    const colors = (members || []).filter((m: any) => m.group_id === col.id && swatches.has(m.color_id))
      .map((m: any) => swatches.get(m.color_id)!)
      .sort(byCode);
    return { letter: col.letter, title: col.title, colors };
  });

  return {
    categoryName: category.name,
    date: options?.date || loaded.list?.priceDate || todayIso(),
    customerName: options?.customerName !== undefined ? options.customerName : loaded.list?.customerName ?? null,
    grid,
    keyGroups,
    priceUnit: priceUnitLabel((category as any).price_unit),
    logoUrl,
    contactWhatsapp: settings.whatsapp_number || null,
    contactLocation: settings.location || null
  };
}
