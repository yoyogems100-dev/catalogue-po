import { supabaseAdmin } from './supabase-admin';
import { fetchAllRows } from './fetch-all-rows';
import { lastOrderFrom, EMPTY_LAST_ORDER, type LastOrder } from './usual-picks';

// How far back to look for a stone's latest lines. A regular buyer's working
// range is well inside this; older orders only matter for stones not seen since.
const RECENT_ORDERS = 40;

/**
 * A buyer's last-order picks (lib/usual-picks lastOrderFrom), read-only:
 * their newest non-binned orders and those orders' lines. `excludeOrderId`
 * leaves out the order being edited, so its own lines don't count as "last".
 */
export async function getLastOrder(customerId: number | null | undefined, excludeOrderId?: number | null): Promise<LastOrder> {
  if (!customerId) return EMPTY_LAST_ORDER;
  try {
    let query = supabaseAdmin.from('orders').select('id, created_at').eq('customer_id', customerId).is('deleted_at', null);
    if (excludeOrderId) query = query.neq('id', excludeOrderId);
    const { data: orders, error } = await query.order('created_at', { ascending: false }).limit(RECENT_ORDERS);
    if (error || !orders?.length) return EMPTY_LAST_ORDER;
    const ids = orders.map((o: { id: number }) => o.id);
    const { data: items } = await fetchAllRows<any>((from, to) =>
      supabaseAdmin.from('order_items').select('order_id, category_id, shape_id, color_id, shape_size_id, custom_size', { count: 'exact' }).in('order_id', ids).order('id').range(from, to));
    const sizeIds = [...new Set((items || []).map((i: any) => i.shape_size_id).filter(Boolean))];
    const { data: sizes } = sizeIds.length ? await supabaseAdmin.from('shape_sizes').select('id, size_mm').in('id', sizeIds) : { data: [] as any[] };
    const sizeById = new Map((sizes || []).map((s: any) => [s.id, s.size_mm as string]));
    return lastOrderFrom(orders, (items || []).map((i: any) => ({ ...i, size_mm: (i.shape_size_id && sizeById.get(i.shape_size_id)) || i.custom_size || null })));
  } catch {
    return EMPTY_LAST_ORDER;
  }
}
