import type { SupabaseClient } from '@supabase/supabase-js';
import { supabasePublic } from './supabase-public';
import type { CategoryPricing } from './pricing-calc';

export async function getCategoryPricing(categoryId: number, client: SupabaseClient = supabasePublic): Promise<CategoryPricing> {
  const [{ data: settingsRow }, { data: members }, { data: priceRows }] = await Promise.all([
    client.from('settings').select('value').eq('key', 'rmb_inr_multiplier').maybeSingle(),
    client.from('color_price_group_members').select('color_id, group_id'),
    client.from('shape_size_prices').select('shape_id, shape_size_id, price_group_id, price_rmb').eq('category_id', categoryId)
  ]);

  const colorToGroup: Record<number, number> = {};
  (members || []).forEach((m: any) => { colorToGroup[m.color_id] = m.group_id; });

  const priceMap: Record<string, number> = {};
  (priceRows || []).forEach((p: any) => {
    priceMap[`${p.shape_id}:${p.shape_size_id}:${p.price_group_id}`] = Number(p.price_rmb);
  });

  return { multiplier: Number((settingsRow as any)?.value) || 1, colorToGroup, priceMap };
}
