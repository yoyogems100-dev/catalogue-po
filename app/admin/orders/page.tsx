import { supabaseAdmin } from '@/lib/supabase-admin';
import { ORDER_MILESTONES, milestoneLabel } from '@/lib/order-milestones';
import { maskPhone } from '@/lib/mask';
import Link from 'next/link';

// See app/admin/tags/page.tsx for why this is needed on every admin page.
// (searchParams usage likely already forces this dynamic, but making it
// explicit removes any doubt.)
export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({ searchParams }: { searchParams: { status?: string } }) {
  const statusFilter = searchParams.status;

  let query = supabaseAdmin
    .from('orders')
    .select('id, customer_id, status, payment_status, created_at, contact_name')
    .order('created_at', { ascending: false });
  if (statusFilter) query = query.eq('status', statusFilter);
  const { data: orders } = await query;

  const customerIds = [...new Set((orders || []).map((o: any) => o.customer_id).filter(Boolean))];
  const { data: customers } = customerIds.length
    ? await supabaseAdmin.from('customers').select('id, name, phone').in('id', customerIds)
    : { data: [] };
  const custMap: Record<number, any> = Object.fromEntries((customers || []).map((c: any) => [c.id, c]));

  const orderIds = (orders || []).map((o: any) => o.id);
  const { data: items } = orderIds.length
    ? await supabaseAdmin.from('order_items').select('order_id, quantity').in('order_id', orderIds)
    : { data: [] };
  const stats: Record<number, { lines: number; pieces: number }> = {};
  (items || []).forEach((it: any) => {
    if (!stats[it.order_id]) stats[it.order_id] = { lines: 0, pieces: 0 };
    stats[it.order_id].lines += 1;
    stats[it.order_id].pieces += it.quantity;
  });

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1>Orders</h1>
        <Link href="/admin/orders/new" className="btn" style={{ display: 'inline-block' }}>+ New order</Link>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        <Link href="/admin/orders" className={`tag-chip ${!statusFilter ? 'active' : ''}`}>All</Link>
        {ORDER_MILESTONES.map((m) => (
          <Link key={m.key} href={`/admin/orders?status=${m.key}`} className={`tag-chip ${statusFilter === m.key ? 'active' : ''}`}>
            {m.label}
          </Link>
        ))}
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Customer</th><th>Date</th><th>Status</th><th>Payment</th><th>Lines</th><th>Pieces</th><th></th></tr>
        </thead>
        <tbody>
          {(orders || []).map((o: any) => {
            const cust = custMap[o.customer_id];
            const s = stats[o.id] || { lines: 0, pieces: 0 };
            return (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>
                  {cust ? (cust.name || maskPhone(cust.phone) || '—') : (o.contact_name || '—')}
                  {cust?.name && cust?.phone ? ` · ${maskPhone(cust.phone)}` : ''}
                </td>
                <td>{new Date(o.created_at).toLocaleDateString('en-IN')}</td>
                <td>{milestoneLabel(o.status)}</td>
                <td><span className={`payment-badge payment-${o.payment_status}`}>{o.payment_status}</span></td>
                <td>{s.lines}</td>
                <td>{s.pieces}</td>
                <td><Link href={`/admin/orders/${o.id}`} className="btn-ghost" style={{ display: 'inline-block' }}>Manage &rarr;</Link></td>
              </tr>
            );
          })}
          {(orders || []).length === 0 && (
            <tr><td colSpan={8} style={{ textAlign: 'center', color: '#8a8370', padding: 30 }}>No orders match this filter.</td></tr>
          )}
        </tbody>
      </table>
    </>
  );
}
