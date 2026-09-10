import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { milestoneLabel } from '@/lib/order-milestones';
export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const queues = [
    { title: 'Awaiting confirmation', href: '/admin/orders?status=placed', query: supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).eq('status','placed') },
    { title: 'Sourcing', href: '/admin/orders?status=sourcing', query: supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).eq('status','sourcing') },
    { title: 'Ready to dispatch', href: '/admin/orders?status=packed', query: supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).eq('status','packed') },
    { title: 'Payment outstanding', href: '/admin/orders?payment=pending', query: supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).eq('payment_status','pending') },
    { title: 'Partial payment', href: '/admin/orders?payment=partial', query: supabaseAdmin.from('orders').select('id', {count:'exact',head:true}).eq('payment_status','partial') }
  ];
  const counts = await Promise.all(queues.map(queue => queue.query));
  const {data: recent, error} = await supabaseAdmin.from('orders').select('id,status,contact_name,created_at').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(8);
  return <>
    <h1>Overview</h1><p>Orders needing attention and shortcuts for today’s work.</p>
    <div className="admin-work-queues">{queues.map((queue,index) => <Link key={queue.title} className="card" href={queue.href}>
      <span>{queue.title}</span><strong>{counts[index].error ? 'Unavailable' : counts[index].count ?? 0}</strong>
    </Link>)}</div>
    <nav className="admin-coverage-filters" aria-label="Quick actions"><Link className="btn" href="/admin/orders/new">Create order</Link><Link className="btn-ghost" href="/admin/orders?type=quotations">Review quotations</Link><Link className="btn-ghost" href="/admin/categories">Review catalogue completeness</Link><Link className="btn-ghost" href="/admin/pricing">Manage prices</Link></nav>
    <h2>Recent orders</h2>
    {error ? <p role="alert">Recent orders could not be loaded. Please refresh.</p> : <ul className="admin-recent-orders">{(recent || []).map(order => <li key={order.id}><Link href={`/admin/orders/${order.id}`}><strong>#{order.id}</strong> · {order.contact_name || 'Order details'} · {milestoneLabel(order.status)}</Link><time dateTime={order.created_at}>{new Date(order.created_at).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</time></li>)}</ul>}
    {!error && !recent?.length && <p>No orders yet.</p>}
  </>;
}
