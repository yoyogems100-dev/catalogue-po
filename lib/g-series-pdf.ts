import { supabaseAdmin } from './supabase-admin';
import { getSettings } from './settings';
import { getPdfLogoDataUrl } from './pdf/brand';
import { publicThumbDataUrl } from './pdf/image-data-url';
import { priceUnitLabel } from './price-unit';
import { buildGSeriesGrid, G_SERIES_PREFIX, parseGSeriesGroup } from './g-series-grid';
import type { GSeriesPriceListData, GSeriesSwatch } from './pdf/GSeriesPriceListDocument';
import type { GSeriesGrid } from './g-series-grid';
import { todayIso, type PriceListOptions } from './price-list-options';

const byCode = (a: GSeriesSwatch, b: GSeriesSwatch) => a.code.localeCompare(b.code, undefined, { numeric: true });

/** "G-40 White D" -> { code: "G-40", name: "White D" }. */
function splitColorName(name: string) {
  const [code, ...rest] = name.split(' ');
  return { code, name: rest.join(' ') };
}

async function gSeriesGroups(categoryId: number) {
  const { data: groups } = await supabaseAdmin
    .from('color_price_groups').select('id, name').eq('category_id', categoryId).like('name', `${G_SERIES_PREFIX}%`);
  return (groups || []).filter((g: any) => parseGSeriesGroup(g.name)) as { id: number; name: string }[];
}

async function gridFor(categoryId: number, gGroups: { id: number; name: string }[]): Promise<GSeriesGrid> {
  const groupIds = gGroups.map((g) => g.id);
  const [{ data: shapeLinks }, { data: sizeLinks }, { data: prices }] = await Promise.all([
    supabaseAdmin.from('category_shapes').select('shape_id, shapes(id, name, icon_key)').eq('category_id', categoryId),
    supabaseAdmin.from('category_shape_sizes').select('shape_sizes(id, shape_id, size_mm)').eq('category_id', categoryId),
    supabaseAdmin.from('shape_size_prices').select('shape_size_id, price_group_id, price_inr').eq('category_id', categoryId).in('price_group_id', groupIds)
  ]);
  const shapes = (shapeLinks || []).map((l: any) => {
    const shape = Array.isArray(l.shapes) ? l.shapes[0] : l.shapes;
    return { id: l.shape_id, name: shape?.name || `Shape ${l.shape_id}`, iconKey: shape?.icon_key ?? null };
  });
  const sizes = (sizeLinks || []).map((l: any) => l.shape_sizes).filter(Boolean)
    .map((s: any) => ({ id: s.id, shapeId: s.shape_id, sizeMm: s.size_mm }));
  return buildGSeriesGrid(gGroups, shapes, sizes,
    (prices || []).filter((p: any) => p.price_inr !== null).map((p: any) => ({ shapeSizeId: p.shape_size_id, groupId: p.price_group_id, price: Number(p.price_inr) })));
}

/** The saved price grid alone, for the download dialog; null when the category has no G-Series columns. */
export async function loadGSeriesGrid(categoryId: number): Promise<GSeriesGrid | null> {
  const gGroups = await gSeriesGroups(categoryId);
  return gGroups.length ? gridFor(categoryId, gGroups) : null;
}

/**
 * Data for the illustrated G-Series price list, or null when the category
 * has no G-Series price columns (every other category keeps the plain list).
 * Options print a customer's name and date, and replace the saved prices for
 * this one copy -- nothing is written back.
 */
export async function loadGSeriesPriceList(categoryId: number, options?: PriceListOptions): Promise<GSeriesPriceListData | null> {
  const gGroups = await gSeriesGroups(categoryId);
  if (!gGroups.length) return null;
  const groupIds = gGroups.map((g) => g.id);

  const [{ data: category }, grid, { data: members }, { data: colorLinks }, settings, logoUrl] = await Promise.all([
    supabaseAdmin.from('categories').select('name, price_unit').eq('id', categoryId).single(),
    gridFor(categoryId, gGroups),
    supabaseAdmin.from('color_price_group_members').select('group_id, color_id').in('group_id', groupIds),
    supabaseAdmin.from('category_colors').select('color_id, colors(name, hex_value, ref_photo_url)').eq('category_id', categoryId),
    getSettings(),
    getPdfLogoDataUrl()
  ]);
  if (!category) return null;
  if (options?.prices) grid.rows.forEach((row, i) => { row.prices = options.prices![i]; });

  // The category's colours, each as a photo swatch.
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
    date: options?.date || todayIso(),
    customerName: options?.customerName || null,
    grid,
    keyGroups,
    priceUnit: priceUnitLabel((category as any).price_unit),
    logoUrl,
    contactWhatsapp: settings.whatsapp_number || null,
    contactLocation: settings.location || null
  };
}
