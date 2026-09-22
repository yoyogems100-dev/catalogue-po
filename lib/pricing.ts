import type { SupabaseClient } from '@supabase/supabase-js';
import { supabasePublic } from './supabase-public';
import { type CategoryPricing } from './pricing-calc';

export async function getCategoryPricing(categoryId: number, client: SupabaseClient = supabasePublic): Promise<CategoryPricing> {
  const [{ data: members }, { data: priceRows }, { data: groups }] = await Promise.all([
    client.from('color_price_group_members').select('color_id, group_id'),
    client.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_inr').eq('category_id', categoryId),
    client.from('color_price_groups').select('id, is_catch_all, category_id')
  ]);

  // A group belongs to one category (or is global). Without this a colour
  // shared by twenty categories would price every one of them off whichever
  // single category's group happens to contain it.
  const inScope = new Set(
    (groups || []).filter((g: any) => !g.is_catch_all && (g.category_id == null || g.category_id === categoryId)).map((g: any) => g.id)
  );
  const colorToGroup: Record<number, number> = {};
  (members || []).forEach((m: any) => { if (inScope.has(m.group_id)) colorToGroup[m.color_id] = m.group_id; });

  const priceMap: Record<string, number> = {};
  (priceRows || []).forEach((p: any) => {
    if (p.price_inr === null) return;
    priceMap[`${p.shape_id}:${p.shape_size_id}:${p.price_group_id}`] = Number(p.price_inr);
  });

  // The one reserved group standing for "every colour with no group of its
  // own" -- see supabase/migrations/20260920090000_catch_all_price_group.sql.
  const catchAllGroupId = (groups || []).find((g: any) => g.is_catch_all)?.id ?? null;
  return { colorToGroup, priceMap, catchAllGroupId };
}
