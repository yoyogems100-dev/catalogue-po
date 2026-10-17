import { supabaseAdmin } from './supabase-admin';
import type { PriceEntry } from './g-series-entries';
import { entriesFromJson } from './g-series-entries';
export { entriesFromJson };
import { tidyCustomerName } from './price-list-options';

/**
 * Customer prices for any category, in the same table Crushed Ice uses
 * (customer_price_lists): a buyer's own full copy of the category's prices,
 * taken from the defaults and edited. The defaults in shape_size_prices are
 * never changed by a customer's copy. See lib/g-series-pdf.ts for the
 * Crushed Ice grid built on the same rows.
 */

/** Every default price in a category, as entries. */
export async function categoryDefaultEntries(categoryId: number): Promise<PriceEntry[]> {
  const { data } = await supabaseAdmin.from('shape_size_prices').select('shape_size_id, price_group_id, price_inr').eq('category_id', categoryId);
  return (data || []).filter((p: any) => p.price_inr !== null)
    .map((p: any) => ({ shapeSizeId: p.shape_size_id, groupId: p.price_group_id, price: Number(p.price_inr) }));
}

/** One customer's saved copy for a category, or null. */
export async function customerListEntries(categoryId: number, listId: number) {
  const { data } = await supabaseAdmin.from('customer_price_lists').select('id, customer_name, price_date, prices')
    .eq('category_id', categoryId).eq('id', listId).maybeSingle();
  if (!data) return null;
  return { list: { id: data.id as number, customerName: data.customer_name as string, priceDate: data.price_date as string }, entries: entriesFromJson(data.prices) };
}

/** Buyer account names for the name pickers ("Discovery Jewels"), A to Z. */
export async function buyerNames(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('customers').select('name, company').is('deleted_at', null).limit(5000);
  const names = new Set<string>();
  for (const c of data || []) {
    const name = tidyCustomerName((c as any).name) || tidyCustomerName((c as any).company);
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

/**
 * Entries typed on the Pricing page, kept only where they belong to this
 * category (a size it carries, a price column in its scope) and are sane.
 */
export async function validEntries(categoryId: number, raw: unknown): Promise<PriceEntry[] | null> {
  if (!Array.isArray(raw) || raw.length > 20000) return null;
  const [{ data: sizeLinks }, { data: groups }] = await Promise.all([
    supabaseAdmin.from('category_shape_sizes').select('shape_size_id').eq('category_id', categoryId),
    supabaseAdmin.from('color_price_groups').select('id, category_id'),
  ]);
  const sizes = new Set((sizeLinks || []).map((r: any) => r.shape_size_id));
  const cols = new Set((groups || []).filter((g: any) => g.category_id == null || g.category_id === categoryId).map((g: any) => g.id));
  const out = new Map<string, PriceEntry>();
  for (const e of raw as any[]) {
    const s = Number(e?.s), g = Number(e?.g), p = Number(e?.p);
    if (!sizes.has(s) || !cols.has(g) || !Number.isFinite(p) || p < 0 || p > 10_000_000) return null;
    out.set(`${s}:${g}`, { shapeSizeId: s, groupId: g, price: Math.round(p * 100) / 100 });
  }
  return [...out.values()];
}
