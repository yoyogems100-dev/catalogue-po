import { supabaseAdmin } from '@/lib/supabase-admin';
import { fetchAllRows } from '@/lib/fetch-all-rows';

/** Every place saved on at least one customer, alphabetically. */
export async function getUsedPlaces(): Promise<string[]> {
  const { data } = await fetchAllRows<{ place: string }>((from, to) =>
    supabaseAdmin.from('customers').select('place', { count: 'exact' }).not('place', 'is', null).range(from, to));
  return [...new Set((data || []).map((r) => r.place).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
