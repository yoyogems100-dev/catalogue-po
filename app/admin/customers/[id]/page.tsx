import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import CustomerProfileEditor from './CustomerProfileEditor';
import CategoryChips from '@/components/admin/CategoryChips';
import StatusTag from '@/components/admin/StatusTag';

export const dynamic = 'force-dynamic';

export default async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const customerId = Number((await params).id);
  const tab = (await searchParams).tab === 'orders' ? 'orders' : 'details';
  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabaseAdmin.from('customers').select('*').eq('id', customerId).maybeSingle(),
    supabaseAdmin.from('orders').select('id,status,payment_status,request_type,created_at').eq('customer_id', customerId).order('created_at', { ascending: false }),
  ]);
  if (!customer) return <p>Customer not found. <Link href="/admin/customers">Back to customers</Link></p>;

  const orderIds = (orders || []).map((order: any) => order.id);
  const [{ data: items }, { data: categories }] = await Promise.all([
    orderIds.length ? supabaseAdmin.from('order_items').select('order_id,quantity,category_id').in('order_id', orderIds) : Promise.resolve({ data: [] as any[] }),
    supabaseAdmin.from('categories').select('id,name')
  ]);
  const categoryNameById: Record<number, string> = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));
  const counts = new Map<number, { lines: number; pieces: number; categoryNames: string[] }>();
  for (const item of items || []) {
    const value = counts.get(item.order_id) || { lines: 0, pieces: 0, categoryNames: [] };
    value.lines += 1; value.pieces += item.quantity;
    const name = categoryNameById[item.category_id];
    if (name && !value.categoryNames.includes(name)) value.categoryNames.push(name);
    counts.set(item.order_id, value);
  }

  return <>
    <Link className="back-link" href="/admin/customers">← All customers</Link>
    <div className="admin-page-head"><div><h1>{customer.name || 'Unnamed customer'}</h1><p>{customer.company || 'No company added'} · {customer.phone || customer.email || 'No contact added'}{customer.place ? ` · ${customer.place}` : ''}</p></div><Link className="btn" href={`/admin/orders/new?customer=${customer.id}`}>+ New order</Link></div>
    <nav className="admin-coverage-filters" aria-label="Customer sections">
      <Link href={`/admin/customers/${customerId}`} className={`tag-chip ${tab === 'details' ? 'active' : ''}`} aria-current={tab === 'details' ? 'page' : undefined}>Details</Link>
      <Link href={`/admin/customers/${customerId}?tab=orders`} className={`tag-chip ${tab === 'orders' ? 'active' : ''}`} aria-current={tab === 'orders' ? 'page' : undefined}>Order history ({orders?.length || 0})</Link>
    </nav>
    {tab === 'details' ? (
      <CustomerProfileEditor customer={customer} />
    ) : (
      <section className="admin-linked-records">
        <div className="admin-section-head"><div><h2>Order history</h2><p>Every order and quotation linked to this customer.</p></div></div>
        <div className="admin-record-grid">
          {(orders || []).map((order: any) => {
            const summary = counts.get(order.id);
            return (
              <article className="card admin-record-card" key={order.id}>
                <Link className="admin-record-main" href={`/admin/orders/${order.id}`}>
                  <strong>Order #{order.id}</strong>
                  <span>{new Date(order.created_at).toLocaleDateString('en-IN')} · {order.request_type === 'Place Order' ? 'Purchase' : order.request_type}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><StatusTag status={order.status} /> · {order.payment_status || 'pending'}</span>
                </Link>
                {/* Outside the record-main link -- CategoryChips' "+N more"
                    is a real button, and nesting it inside that whole-card
                    link would make clicking it also navigate away. */}
                <CategoryChips names={summary?.categoryNames || []} />
                <div className="admin-record-actions"><Link className="btn-ghost" href={`/admin/orders/${order.id}`}>View order</Link><Link className="btn-ghost" href={`/admin/orders/new?customer=${customer.id}&from=${order.id}`}>Repeat order</Link></div>
              </article>
            );
          })}
          {!orders?.length && <p>No orders have been linked to this customer yet.</p>}
        </div>
      </section>
    )}
  </>;
}
