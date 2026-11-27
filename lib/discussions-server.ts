import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { DISCUSSION_PLACES_SETTING_KEY, parseDiscussionPlaces, sanitizeItems, type Discussion } from './discussions';

/** One buyer's discussions, newest meeting first. `missing` is true until the
 *  customer_discussions migration has run, so pages still open before it. */
export async function getDiscussions(customerId: number): Promise<{ discussions: Discussion[]; missing: boolean }> {
  const { data, error } = await supabaseAdmin.from('customer_discussions')
    .select('id, customer_id, held_on, place, items, notes, created_at, updated_at')
    .eq('customer_id', customerId)
    .order('held_on', { ascending: false }).order('id', { ascending: false });
  if (error) {
    const missing = error.code === '42P01' || error.code === 'PGRST205' || /customer_discussions/.test(error.message || '');
    if (!missing) console.error('discussions read failed', error.message);
    return { discussions: [], missing };
  }
  return { discussions: (data || []).map((d: any) => ({ ...d, items: sanitizeItems(d.items) })), missing: false };
}

export async function getDiscussionPlaces(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('settings').select('value').eq('key', DISCUSSION_PLACES_SETTING_KEY).maybeSingle();
  return parseDiscussionPlaces(data?.value);
}
