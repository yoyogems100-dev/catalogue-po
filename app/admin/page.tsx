import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import StatusTag from '@/components/admin/StatusTag';
import { NotificationsPreview } from '@/components/admin/NotificationsFeed';
import { AdminSearchBar } from '@/components/admin/AdminSearch';
import DashboardQuickActions from '@/components/admin/DashboardQuickActions';
import AccessRequests from '@/components/admin/AccessRequests';
import { ACCESS_REQUEST_TAG } from '@/lib/access-requests';
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const today = new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0,10);
  // Every count excludes binned orders, matching what the list these cards
  // link to actually shows -- otherwise a card could read 3 and open a page
  // listing 1.
  const countable = () => supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).is('deleted_at', null);
  const queues = [
    { title: 'New catalogue requests', href: '/admin/site/leads', query: supabaseAdmin.from('site_leads').select('id', {count:'exact',head:true}).eq('status','new') },
    { title: 'Orders placed today', href: `/admin/orders?from=${today}&to=${today}`, query: countable().gte('created_at', `${today}T00:00:00+05:30`).lte('created_at', `${today}T23:59:59.999+05:30`) },
    { title: 'Awaiting confirmation', href: '/admin/orders?status=placed', query: countable().eq('status','placed') },
    { title: 'Sourcing', href: '/admin/orders?status=sourcing', query: countable().eq('status','sourcing') },
    { title: 'Ready to dispatch', href: '/admin/orders?status=packed', query: countable().eq('status','packed') },
    { title: 'Payment outstanding', href: '/admin/orders?payment=pending', query: countable().eq('payment_status','pending') },
    { title: 'Partial payment', href: '/admin/orders?payment=partial', query: countable().eq('payment_status','partial') }
  ];
  const [counts, {data: qaCategories}, {data: qaTags}, {data: accessRows}] = await Promise.all([
    Promise.all(queues.map(queue => queue.query)),
    // For the quick-action forms below.
    supabaseAdmin.from('categories').select('id,name').order('num'),
    supabaseAdmin.from('tags').select('id,name').order('name'),
    // Sign-up requests waiting for a PIN (see lib/access-requests).
    supabaseAdmin.from('customers').select('id,name,company,phone,created_at').contains('tags', [ACCESS_REQUEST_TAG]).is('deleted_at', null).order('created_at', {ascending:false}).limit(50)
  ]);
  // "Order details" used to stand in for every order whose contact_name was
  // null, which is most of them -- a row reading "#8 - Order details - Placed"
  // gives nothing worth scanning. A guest order genuinely has no name, but one
  // placed from an account does: it is on the customer record, the same lookup
  // the orders list does. Line counts come from one batched query, not one per
  // row. Soft-deleted orders are excluded, as they already are on the list.
  const {data: recent, error} = await supabaseAdmin.from('orders')
    .select('id,status,contact_name,created_at,customer_id')
    .is('deleted_at', null)
    .order('created_at',{ascending:false}).order('id',{ascending:false}).limit(8);
  const recentIds = (recent || []).map(o => o.id);
  const recentCustomerIds = [...new Set((recent || []).map(o => o.customer_id).filter(Boolean))] as number[];
  const [{data: recentCustomers}, {data: recentItems}] = await Promise.all([
    recentCustomerIds.length
      ? supabaseAdmin.from('customers').select('id,name,company').in('id', recentCustomerIds)
      : Promise.resolve({data: [] as {id:number;name:string|null;company:string|null}[]}),
    recentIds.length
      ? supabaseAdmin.from('order_items').select('order_id').in('order_id', recentIds)
      : Promise.resolve({data: [] as {order_id:number}[]})
  ]);
  const customerById = new Map((recentCustomers || []).map(c => [c.id, c]));
  const lineCount = (recentItems || []).reduce<Record<number, number>>((acc, row) => {
    acc[row.order_id] = (acc[row.order_id] || 0) + 1;
    return acc;
  }, {});
  const recentName = (order: {contact_name: string|null; customer_id: number|null}) => {
    const customer = order.customer_id ? customerById.get(order.customer_id) : null;
    return order.contact_name || customer?.name || customer?.company || 'Guest order';
  };
  return <>
    <h1>Admin overview</h1><p>Orders needing attention and shortcuts for today’s work.</p>
    <AdminSearchBar />
    <nav className="admin-overview-actions" aria-label="Quick actions">
      <Link className="btn" href="/admin/customers?new=1">+ New customer</Link>
      <Link className="btn" href="/admin/orders/new">+ Create order</Link>
      <Link className="btn-ghost" href="/admin/categories">Categories</Link>
      <Link className="btn-ghost" href="/admin/customers">Customers</Link>
      <Link className="btn-ghost" href="/admin/suppliers">Suppliers</Link>
    </nav>
    <NotificationsPreview />
    <AccessRequests initial={(accessRows || []).map(r => ({id: r.id, name: r.name, company: r.company, phone: r.phone, createdAt: r.created_at}))} />
    <div className="admin-work-queues">{queues.map((queue,index) => <Link key={queue.title} className="card" href={queue.href}>
      <span>{queue.title}</span><strong>{counts[index].error ? 'Unavailable' : counts[index].count ?? 0}</strong>
    </Link>)}</div>
    <nav className="admin-coverage-filters" aria-label="Shortcuts"><Link className="btn-ghost" href="/admin/categories">Review catalogue completeness</Link><Link className="btn-ghost" href="/admin/pricing">Manage prices</Link><Link className="btn-ghost" href="/admin/bulk-link">Bulk link shapes &amp; colours</Link><Link className="btn-ghost" href="/admin/site">Manage website</Link></nav>
    <DashboardQuickActions categories={qaCategories || []} tags={qaTags || []} />
    <h2>Recent orders</h2>
    {error ? <p role="alert">Recent orders could not be loaded. Please refresh.</p> : <ul className="admin-recent-orders">{(recent || []).map(order => <li key={order.id}><Link href={`/admin/orders/${order.id}`}><strong>#{order.id}</strong> · {recentName(order)}{lineCount[order.id] ? ` · ${lineCount[order.id]} ${lineCount[order.id] === 1 ? 'line' : 'lines'}` : ''}</Link><span className="admin-recent-orders-meta"><StatusTag status={order.status} /><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</time></span></li>)}</ul>}
    {!error && !recent?.length && <p>No orders yet.</p>}
  </>;
}
