import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { milestoneLabel } from '@/lib/order-milestones';

export const dynamic = 'force-dynamic';

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = (await searchParams).q?.trim().slice(0, 80) || '';
  let query = supabaseAdmin.from('customers').select('*').order('created_at', { ascending: false }).limit(250);
  if (q) query = query.or(`name.ilike.%${q.replace(/[,()%]/g, '')}%,company.ilike.%${q.replace(/[,()%]/g, '')}%,phone.ilike.%${q.replace(/[,()%]/g, '')}%`);
  const { data: customers, error } = await query;
  const customerIds = (customers || []).map((customer: any) => customer.id);
  const { data: orders } = customerIds.length
    ? await supabaseAdmin.from('orders').select('id,customer_id,status,created_at').in('customer_id', customerIds).order('created_at', { ascending: false })
    : { data: [] };
  const stats = new Map<number, { count: number; latest?: any }>();
  for (const order of orders || []) {
    const current = stats.get(order.customer_id) || { count: 0 };
    current.count += 1;
    if (!current.latest) current.latest = order;
    stats.set(order.customer_id, current);
  }

  return <>
    <div className="admin-page-head"><div><h1>Customers</h1><p>Customer profiles, buying preferences and complete order history.</p></div><Link className="btn" href="/admin/orders/new">+ New customer order</Link></div>
    <form className="admin-directory-search"><input name="q" defaultValue={q} placeholder="Search name, company or WhatsApp number" /><button className="btn" type="submit">Search</button>{q && <Link className="btn-ghost" href="/admin/customers">Clear</Link>}</form>
    {error && <p role="alert">Customers could not be loaded. Please refresh.</p>}
    <p className="admin-results-summary">{(customers || []).length} customers</p>
    <div className="admin-customer-cards">
      {(customers || []).map((customer: any) => {
        const customerStats = stats.get(customer.id);
        return <Link href={`/admin/customers/${customer.id}`} className="card admin-customer-card" key={customer.id}>
          <strong>{customer.name || 'Unnamed customer'}</strong>
          <span>{customer.company || 'No company'} · {customer.phone || 'No WhatsApp number'}</span>
          <span>{customer.work_stream || 'Work stream not added'}</span>
          <small>{customerStats?.count || 0} orders{customerStats?.latest ? ` · Latest: ${milestoneLabel(customerStats.latest.status)}` : ''}</small>
        </Link>;
      })}
    </div>
    <div className="admin-directory-table-wrap" tabIndex={0} role="region" aria-label="Customer directory">
      <table><thead><tr><th>Customer</th><th>Company</th><th>WhatsApp</th><th>Work stream</th><th>Go-to requirements</th><th>Orders</th><th>Latest status</th></tr></thead>
      <tbody>{(customers || []).map((customer: any) => { const customerStats = stats.get(customer.id); return <tr key={customer.id}>
        <td><Link href={`/admin/customers/${customer.id}`} className="admin-table-link">{customer.name || 'Unnamed customer'}</Link></td>
        <td>{customer.company || '—'}</td><td>{customer.phone || '—'}</td><td>{customer.work_stream || '—'}</td><td className="admin-table-wrap-text">{customer.go_to_requirements || '—'}</td>
        <td>{customerStats?.count || 0}</td><td>{customerStats?.latest ? milestoneLabel(customerStats.latest.status) : '—'}</td>
      </tr>; })}</tbody></table>
    </div>
  </>;
}
