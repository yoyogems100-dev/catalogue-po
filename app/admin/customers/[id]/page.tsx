import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { milestoneLabel } from '@/lib/order-milestones';
import CustomerProfileEditor from './CustomerProfileEditor';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const customerId = Number((await params).id);
  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle(),
    supabaseAdmin.from('orders').select('id,status,payment_status,request_type,created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
  ]);
  if (!customer) return <p>Customer not found. <Link href="/admin/customers">Back to customers</Link></p>;
  const orderIds = (orders || []).map((order: any) => order.id);
  const { data: items } = orderIds.length ? await supabaseAdmin.from('order_items').select('order_id,quantity').in('order_id', orderIds) : { data: [] };
  const counts = new Map<number, { lines: number; pieces: number }>();
  for (const item of items || []) { const value = counts.get(item.order_id) || { lines: 0, pieces: 0 }; value.lines += 1; value.pieces += item.quantity; counts.set(item.order_id, value); }
  return <>
    <Link className="back-link" href="/admin/customers">← All customers</Link>
    <div className="admin-page-head"><div><h1>{customer.name || 'Unnamed customer'}</h1><p>{customer.company || 'No company added'} · {customer.phone || customer.email || 'No contact added'}</p></div><Link className="btn" href={`/admin/orders/new?customer=${customer.id}`}>+ New order</Link></div>
    <CustomerProfileEditor customer={customer} />
    <section className="admin-linked-records"><div className="admin-section-head"><div><h2>Order history</h2><p>Every order and quotation linked to this customer.</p></div></div>
      <div className="admin-record-grid">{(orders || []).map((order: any) => { const count = counts.get(order.id); return <article className="card admin-record-card" key={order.id}>
        <Link className="admin-record-main" href={`/admin/orders/${order.id}`}><strong>Order #{order.id}</strong><span>{new Date(order.created_at).toLocaleDateString('en-IN')} · {order.request_type === 'Place Order' ? 'Purchase' : order.request_type}</span><span>{milestoneLabel(order.status)} · {order.payment_status || 'pending'}</span><small>{count?.lines || 0} lines · {(count?.pieces || 0).toLocaleString('en-IN')} pcs</small></Link>
        <div className="admin-record-actions"><Link className="btn-ghost" href={`/admin/orders/${order.id}`}>View order</Link><Link className="btn-ghost" href={`/admin/orders/new?customer=${customer.id}&from=${order.id}`}>Repeat order</Link></div>
      </article>; })}{!orders?.length && <p>No orders have been linked to this customer yet.</p>}</div>
    </section>
  </>;
}
