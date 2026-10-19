// The team's pending sheet, from the orders themselves: every purchase line
// on an open order that still has something left to send, grouped by buyer.
import { balanceOf, sentOf } from './line-fulfilment';

export type PendingOrder = { id: number; customer_id: number | null; contact_name: string | null; created_at: string; status: string };
export type PendingItemRow = {
  id: number; order_id: number; category_id: number; shape_id: number | null; shape_size_id: number | null;
  color_id: number | null; custom_size?: string | null; quantity: number; request_type?: string | null;
  sent_qty?: number | null; needs_check?: boolean | null; note?: string | null;
};
export type Names = {
  category: Record<number, string>; shape: Record<number, string>; size: Record<number, string>;
  color: Record<number, string>; customer: Record<number, { name: string | null; company: string | null }>;
};

export type PendingLine = {
  id: number; orderId: number; orderDate: string; stone: string; colour: string; shape: string; size: string;
  quantity: number; sent: number; left: number; needsCheck: boolean; note: string | null;
};
export type PendingBuyer = {
  key: string; customerId: number | null; name: string | null; company: string | null;
  orderIds: number[]; lines: PendingLine[]; left: number; oldest: string;
};

/** Purchase lines with something left to send, grouped by buyer, oldest waiting first. */
export function pendingByBuyer(orders: PendingOrder[], items: PendingItemRow[], names: Names, opts: { search?: string; checkOnly?: boolean } = {}): PendingBuyer[] {
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const q = (opts.search || '').trim().toLowerCase();
  const buyers = new Map<string, PendingBuyer>();
  for (const it of items) {
    const order = orderById.get(it.order_id);
    if (!order || it.request_type === 'Request Quotation') continue;
    const sent = sentOf(it);
    const left = balanceOf(it.quantity, sent);
    if (left <= 0) continue;
    if (opts.checkOnly && !it.needs_check) continue;
    const customer = order.customer_id ? names.customer[order.customer_id] : undefined;
    const line: PendingLine = {
      id: it.id, orderId: order.id, orderDate: order.created_at,
      stone: names.category[it.category_id] || '—',
      colour: (it.color_id && names.color[it.color_id]) || '—',
      shape: (it.shape_id && names.shape[it.shape_id]) || '—',
      size: (it.shape_size_id && names.size[it.shape_size_id]) || it.custom_size || '—',
      quantity: it.quantity, sent, left, needsCheck: !!it.needs_check, note: it.note || null,
    };
    const buyerName = customer?.name || order.contact_name || null;
    if (q && ![buyerName, customer?.company, line.stone, line.colour, line.shape, line.size, `#${order.id}`]
      .some((v) => v && v.toLowerCase().includes(q))) continue;
    const key = order.customer_id ? `c${order.customer_id}` : `o${order.id}`;
    const b = buyers.get(key) || { key, customerId: order.customer_id, name: buyerName, company: customer?.company || null, orderIds: [], lines: [], left: 0, oldest: order.created_at };
    if (!b.orderIds.includes(order.id)) b.orderIds.push(order.id);
    b.lines.push(line);
    b.left += left;
    if (order.created_at < b.oldest) b.oldest = order.created_at;
    buyers.set(key, b);
  }
  for (const b of buyers.values()) {
    b.orderIds.sort((x, y) => x - y);
    b.lines.sort((x, y) => x.orderId - y.orderId || x.stone.localeCompare(y.stone) || x.colour.localeCompare(y.colour) || x.shape.localeCompare(y.shape) || x.size.localeCompare(y.size, 'en', { numeric: true }));
  }
  return [...buyers.values()].sort((a, b) => a.oldest.localeCompare(b.oldest));
}
